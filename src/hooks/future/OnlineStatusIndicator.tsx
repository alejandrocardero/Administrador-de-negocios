import { useSync } from './useSyncContext';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function OnlineStatusIndicator() {
  const { isOnline, wasOffline, isSyncing, pendingCount, forceSync, syncError } = useSync();

  if (isOnline && !wasOffline && pendingCount === 0) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <Wifi className="w-3 h-3 mr-1" /> En línea
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={isOnline ? 'default' : 'destructive'} 
        className={cn(
          'flex items-center gap-1',
          isOnline ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
        )}
      >
        {isOnline ? (
          <>
            <Wifi className="w-3 h-3 mr-1" />
            En línea
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3 mr-1" />
            Sin conexión
          </>
        )}
      </Badge>

      {(pendingCount > 0 || isSyncing) && (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 flex items-center gap-1">
          <RefreshCw className={cn('w-3 h-3', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Sincronizando...' : `${pendingCount} pendientes`}
        </Badge>
      )}

      {wasOffline && isOnline && pendingCount === 0 && (
        <Badge variant="default" className="bg-green-100 text-green-800 animate-pulse">
          <Wifi className="w-3 h-3 mr-1" /> Conexión restaurada
        </Badge>
      )}

      {syncError && (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Error de sync
        </Badge>
      )}

      {(!isOnline || pendingCount > 0) && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={forceSync}
          disabled={isSyncing || !isOnline}
          className="ml-1"
        >
          <RefreshCw className={cn('w-3 h-3 mr-1', isSyncing && 'animate-spin')} />
          Sincronizar
        </Button>
      )}
    </div>
  );
}