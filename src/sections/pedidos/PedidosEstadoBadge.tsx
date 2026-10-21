import { StatusBadge, type StatusTone } from '@/components/shared';

const estadoTone: Record<string, StatusTone> = {
  pendiente: 'warning',
  aprobado: 'info',
  entregado: 'success',
  cancelado: 'danger',
};

/** Badge canónico para el estado de un pedido. */
export function PedidosEstadoBadge({ estado }: { estado: string }) {
  return (
    <StatusBadge tone={estadoTone[estado] ?? 'neutral'}>
      {estado}
    </StatusBadge>
  );
}
