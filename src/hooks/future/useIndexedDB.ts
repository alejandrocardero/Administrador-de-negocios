import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AdminNegocioDB extends DBSchema {
  data: {
    key: string;
    value: any;
  };
  syncQueue: {
    key: number;
    value: SyncOperation;
  };
}

export interface SyncOperation {
  id?: number;
  type: 'create' | 'update' | 'delete';
  store: string;
  data: any;
  timestamp: number;
  synced: boolean;
}

const DB_NAME = 'adminnegocio-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<AdminNegocioDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AdminNegocioDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AdminNegocioDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data');
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('by-store', 'store');
        syncStore.createIndex('by-synced', 'synced');
        syncStore.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  return dbInstance;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('data', key);
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('data', value, key);
}

export async function idbDelete(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('data', key);
}

export async function idbGetAllKeys(): Promise<string[]> {
  const db = await getDB();
  return db.getAllKeys('data');
}

export async function idbClear(): Promise<void> {
  const db = await getDB();
  await db.clear('data');
}

export async function addSyncOperation(op: Omit<SyncOperation, 'id' | 'synced' | 'timestamp'>): Promise<number> {
  const db = await getDB();
  const id = await db.add('syncQueue', {
    ...op,
    timestamp: Date.now(),
    synced: false,
  } as SyncOperation);
  return id as number;
}

export async function getPendingSyncOperations(): Promise<SyncOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-synced', false);
}

export async function markSyncOperationSynced(id: number): Promise<void> {
  const db = await getDB();
  const op = await db.get('syncQueue', id);
  if (op) {
    op.synced = true;
    await db.put('syncQueue', op);
  }
}

export async function removeSyncOperation(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function clearSyncedOperations(): Promise<void> {
  const db = await getDB();
  const synced = await db.getAllFromIndex('syncQueue', 'by-synced', true);
  for (const op of synced) {
    if (op.id) await db.delete('syncQueue', op.id);
  }
}