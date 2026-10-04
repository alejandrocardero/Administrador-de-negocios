import { useState, useEffect, useCallback } from 'react';
import { 
  addSyncOperation, 
  getPendingSyncOperations, 
  markSyncOperationSynced,
  removeSyncOperation,
  clearSyncedOperations,
  SyncOperation 
} from './useIndexedDB';

interface SyncConfig {
  apiBaseUrl: string;
  onSyncComplete?: (syncedCount: number) => void;
  onSyncError?: (error: Error) => void;
  retryInterval?: number;
  maxRetries?: number;
}

export function useSyncQueue(config: SyncConfig) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const {
    apiBaseUrl,
    onSyncComplete,
    onSyncError,
    retryInterval = 30000,
    maxRetries = 3,
  } = config;

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingSyncOperations();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  const syncOperation = useCallback(async (op: SyncOperation): Promise<boolean> => {
    try {
      const url = `${apiBaseUrl}/api/${op.store}`;
      let method: string;
      let body: string | undefined;

      switch (op.type) {
        case 'create':
          method = 'POST';
          body = JSON.stringify(op.data);
          break;
        case 'update':
          method = 'PUT';
          body = JSON.stringify(op.data);
          break;
        case 'delete':
          method = 'DELETE';
          break;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Sync operation failed:', error);
      return false;
    }
  }, [apiBaseUrl]);

  const processSyncQueue = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      const pending = await getPendingSyncOperations();
      let syncedCount = 0;

      for (const op of pending) {
        if (!navigator.onLine) break;

        const success = await syncOperation(op);
        if (success) {
          await markSyncOperationSynced(op.id!);
          syncedCount++;
        } else {
          setSyncError(`Error sincronizando ${op.store}`);
          break;
        }
      }

      await clearSyncedOperations();
      setLastSyncTime(Date.now());
      await refreshPendingCount();

      if (syncedCount > 0 && onSyncComplete) {
        onSyncComplete(syncedCount);
      }
    } catch (error) {
      const err = error as Error;
      setSyncError(err.message);
      if (onSyncError) onSyncError(err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, syncOperation, onSyncComplete, onSyncError, refreshPendingCount]);

  useEffect(() => {
    if (navigator.onLine && pendingCount > 0) {
      processSyncQueue();
    }
  }, [pendingCount, processSyncQueue]);

  useEffect(() => {
    if (!navigator.onLine) return;

    const interval = setInterval(() => {
      if (pendingCount > 0) {
        processSyncQueue();
      }
    }, retryInterval);

    return () => clearInterval(interval);
  }, [pendingCount, processSyncQueue, retryInterval]);

  const forceSync = useCallback(async () => {
    if (navigator.onLine) {
      await processSyncQueue();
    }
  }, [processSyncQueue]);

  const queueOperation = useCallback(async (
    type: 'create' | 'update' | 'delete',
    store: string,
    data: any
  ) => {
    await addSyncOperation({ type, store, data });
    await refreshPendingCount();
    
    if (navigator.onLine) {
      processSyncQueue();
    }
  }, [refreshPendingCount, processSyncQueue]);

  return {
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncError,
    forceSync,
    queueOperation,
    queueCreate: (store: string, data: any) => queueOperation('create', store, data),
    queueUpdate: (store: string, data: any) => queueOperation('update', store, data),
    queueDelete: (store: string, data: any) => queueOperation('delete', store, data),
  };
}