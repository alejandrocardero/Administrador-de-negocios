// Fase 6 (PLAN-OFFLINE-RESPONSIVE): resolución de conflictos de sincronización.
// Regla de oro del plan: NUNCA se sobrescribe en silencio; ambas versiones se
// conservan (espejo local `conflicts` + historial `sync_conflicts` en el
// servidor) y el usuario elige: mi versión / la del servidor / conservar ambas
// / fusionar campo a campo. La resolución se audita en el servidor con el RPC
// `resolver_conflicto` (migración 004, §4.6); localmente se marca resuelto y
// se fuerza un ciclo push→pull para dejar el espejo coherente.

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { markResolved, type LocalConflict } from '@/lib/db/conflicts';
import { db } from '@/lib/db/localDb';
import { looseRpc } from '@/lib/sync/loose';
import { syncNow } from '@/lib/sync/syncEngine';

/** Campos técnicos que nunca se muestran en el diff ni entran a la fusión. */
const CAMPOS_TECNICOS = new Set([
  'id', 'business_id', 'created_at', 'updated_at', 'sync_rev', 'total_vendido',
]);

const TABLA_LABEL: Record<string, string> = {
  productos: 'Producto',
  vendedores: 'Vendedor',
  compradores: 'Comprador',
  ventas_diarias: 'Venta del día',
  compras: 'Compra',
  detalles_compra: 'Detalle de compra',
  gastos: 'Gasto',
  impuestos: 'Impuesto',
  movimientos_caja: 'Movimiento de caja',
  configuracion_negocio: 'Configuración del negocio',
  registros_ipve: 'Registro IPVE',
  pedidos: 'Pedido',
  solicitudes_producto_nuevo: 'Solicitud de producto nuevo',
  salarios_fijos: 'Salario fijo',
  fiados: 'Fiado',
};

const KIND_LABEL: Record<string, string> = {
  update_update: 'Editado en dos lugares a la vez',
  update_delete: 'Editado aquí, eliminado en el servidor',
  delete_update: 'Eliminado aquí, editado en el servidor',
  insert_insert: 'Creado en dos lugares a la vez',
};

function formatear(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

/** Unión de campos de ambas versiones, sin campos técnicos y ordenada. */
function camposDelConflicto(conflicto: LocalConflict): string[] {
  const claves = new Set<string>([
    ...Object.keys(conflicto.serverVersion ?? {}),
    ...Object.keys(conflicto.incomingVersion ?? {}),
  ]);
  return [...claves].filter((k) => !CAMPOS_TECNICOS.has(k)).sort();
}

type Resolucion = 'mine' | 'server' | 'both' | 'merged';

/**
 * Aplica la resolución en el servidor (RPC auditable) y deja el espejo local
 * coherente. Nota: el pull incremental NO re-trae filas cuyo sync_rev no
 * cambió (p. ej. resolución 'server'), por eso se ajusta el espejo a mano.
 */
async function aplicarResolucion(
  conflicto: LocalConflict,
  resolucion: Resolucion,
  payload: Record<string, unknown> | null,
): Promise<void> {
  const { error, data } = await looseRpc('resolver_conflicto', {
    p_conflict_id: conflicto.id,
    p_resolution: resolucion,
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  const estado = (data as { status?: string } | null)?.status;
  if (estado === 'already_resolved') {
    // Otro dispositivo ya la resolvió: solo limpiar localmente.
    await markResolved(conflicto.id);
    void syncNow();
    return;
  }

  const espejo = db.table(conflicto.tableName);
  if (resolucion === 'server') {
    if (conflicto.serverVersion) {
      await espejo.put(conflicto.serverVersion as Record<string, unknown>);
    } else {
      // El servidor borró la fila y el usuario acepta el borrado.
      await espejo.delete(conflicto.rowId);
    }
  } else if (resolucion === 'merged' && payload) {
    // Optimista: pull confirmará con el sync_rev nuevo.
    await espejo.put({ ...(conflicto.serverVersion ?? {}), ...payload });
  }
  await markResolved(conflicto.id);
  void syncNow();
}

export default function ConflictResolver() {
  const { conflicts } = useSyncStatus();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [conflictoActivo, setConflictoActivo] = useState<LocalConflict | null>(null);
  const [modoFusion, setModoFusion] = useState(false);
  /** Por campo: qué versión gana en la fusión ('servidor' | 'mio'). */
  const [fusion, setFusion] = useState<Record<string, 'servidor' | 'mio'>>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campos = useMemo(
    () => (conflictoActivo ? camposDelConflicto(conflictoActivo) : []),
    [conflictoActivo],
  );

  if (conflicts.length === 0) return null;

  const abrirConflicto = (c: LocalConflict) => {
    setConflictoActivo(c);
    setModoFusion(false);
    setError(null);
    // Por defecto cada campo conserva la versión del servidor; si solo
    // existe en la versión local, se parte de la local.
    const inicial: Record<string, 'servidor' | 'mio'> = {};
    for (const campo of camposDelConflicto(c)) {
      inicial[campo] = c.serverVersion && campo in c.serverVersion ? 'servidor' : 'mio';
    }
    setFusion(inicial);
  };

  const resolver = async (resolucion: Resolucion, payload: Record<string, unknown> | null) => {
    if (!conflictoActivo || ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      await aplicarResolucion(conflictoActivo, resolucion, payload);
      setConflictoActivo(null);
      setModoFusion(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo resolver el conflicto');
    } finally {
      setOcupado(false);
    }
  };

  const payloadFusionado = (): Record<string, unknown> | null => {
    if (!conflictoActivo) return null;
    const fusionado: Record<string, unknown> = {};
    for (const campo of campos) {
      const usarMio = fusion[campo] === 'mio';
      const valorMio = conflictoActivo.incomingVersion?.[campo];
      const valorServidor = conflictoActivo.serverVersion?.[campo];
      fusionado[campo] = usarMio ? valorMio : valorServidor;
    }
    return fusionado;
  };

  return (
    <>
      {/* Barra de alerta global: visible mientras haya conflictos abiertos */}
      <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-red-800 text-sm min-w-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="truncate">
            <strong>{conflicts.length}</strong>{' '}
            {conflicts.length === 1 ? 'conflicto de sincronización' : 'conflictos de sincronización'}{' '}
            por resolver. Ningún dato se ha perdido.
          </span>
        </div>
        <Button size="sm" variant="destructive" onClick={() => setDialogOpen(true)}>
          Resolver
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {conflictoActivo ? 'Conflicto de sincronización' : 'Conflictos de sincronización'}
            </DialogTitle>
            <DialogDescription>
              {conflictoActivo
                ? 'Elige qué versión conservar. Tu decisión queda registrada en el historial.'
                : `${conflicts.length} ${conflicts.length === 1 ? 'cambio necesita' : 'cambios necesitan'} tu decisión.`}
            </DialogDescription>
          </DialogHeader>

          {!conflictoActivo ? (
            <div className="space-y-2 py-2">
              {conflicts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => abrirConflicto(c)}
                  className="w-full text-left border border-slate-200 rounded-lg p-3 hover:bg-slate-50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{TABLA_LABEL[c.tableName] ?? c.tableName}</p>
                    <p className="text-xs text-slate-500">
                      {KIND_LABEL[c.kind] ?? c.kind} · detectado {new Date(c.detectedAt).toLocaleString('es-CO')}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600 shrink-0">Revisar →</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{TABLA_LABEL[conflictoActivo.tableName] ?? conflictoActivo.tableName}</p>
                  <p className="text-xs text-slate-500">{KIND_LABEL[conflictoActivo.kind] ?? conflictoActivo.kind}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setConflictoActivo(null); setModoFusion(false); }}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Volver
                </Button>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>Servidor</TableHead>
                      <TableHead>Mío</TableHead>
                      {modoFusion && <TableHead className="w-28">Usar</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campos.map((campo) => {
                      const servidor = conflictoActivo.serverVersion?.[campo];
                      const mio = conflictoActivo.incomingVersion?.[campo];
                      const distinto = JSON.stringify(servidor) !== JSON.stringify(mio);
                      return (
                        <TableRow key={campo} className={distinto ? 'bg-amber-50/60' : ''}>
                          <TableCell className="text-xs font-medium align-top">{campo}</TableCell>
                          <TableCell className="text-xs align-top max-w-48 break-words">{formatear(servidor)}</TableCell>
                          <TableCell className="text-xs align-top max-w-48 break-words">{formatear(mio)}</TableCell>
                          {modoFusion && (
                            <TableCell className="align-top">
                              <select
                                className="text-xs border rounded px-1 py-0.5 w-full"
                                value={fusion[campo] ?? 'servidor'}
                                onChange={(e) => setFusion({ ...fusion, [campo]: e.target.value as 'servidor' | 'mio' })}
                              >
                                <option value="servidor">Servidor</option>
                                <option value="mio">Mío</option>
                              </select>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
              )}

              {modoFusion ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setModoFusion(false)} disabled={ocupado}>
                    Cancelar fusión
                  </Button>
                  <Button onClick={() => resolver('merged', payloadFusionado())} disabled={ocupado}>
                    {ocupado && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Guardar fusión
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setModoFusion(true)} disabled={ocupado || campos.length === 0}>
                    Fusionar campos…
                  </Button>
                  <Button variant="outline" onClick={() => resolver('both', conflictoActivo.incomingVersion ?? null)} disabled={ocupado}>
                    Conservar ambas
                  </Button>
                  <Button variant="outline" onClick={() => resolver('server', null)} disabled={ocupado}>
                    Usar la del servidor
                  </Button>
                  <Button onClick={() => resolver('mine', conflictoActivo.incomingVersion ?? null)} disabled={ocupado}>
                    {ocupado && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Usar mi versión
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
