import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { useSyncQueue, SyncOperation } from './useSyncQueue';
import { getPendingSyncOperations, markSyncOperationSynced, clearSyncedOperations } from './useIndexedDB';

interface SyncContextValue {
  isOnline: boolean;
  wasOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  syncError: string | null;
  forceSync: () => Promise<void>;
  queueOperation: (type: 'create' | 'update' | 'delete', store: string, data: any) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ 
  children, 
  apiBaseUrl = '' 
}: { 
  children: ReactNode; 
  apiBaseUrl?: string;
}) {
  const { isOnline, wasOffline, resetOfflineFlag } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  const {
    isSyncing,
    lastSyncTime,
    syncError,
    forceSync,
    queueOperation,
  } = useSyncQueue({
    apiBaseUrl,
    onSyncComplete: (count) => {
      setPendingCount(prev => Math.max(0, prev - count));
    },
    onSyncError: (error) => {
      console.error('Sync error:', error);
    },
    retryInterval: 30000,
  });

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingSyncOperations();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      forceSync();
    }
  }, [isOnline, pendingCount, forceSync]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline && pendingCount > 0) {
        forceSync();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isOnline, pendingCount, forceSync]);

  const value: SyncContextValue = {
    isOnline,
    wasOffline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncError,
    forceSync,
    queueOperation,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}