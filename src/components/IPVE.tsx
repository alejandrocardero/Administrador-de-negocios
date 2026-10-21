import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, File, Package, Printer, Save, X, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useVendedores, useProductos, useRegistrosIPVE, usePedidos, formatCurrency } from '@/hooks/supabase/useSupabaseData';
import type { AuthUser } from '@/contexts/AuthContext';
import type { Producto, VentaDiaria, RegistroIPVE } from '@/types';

interface IPVEProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: AuthUser;
  modoDiario?: boolean;
  totalCierre?: number; // total desde el registro de cierre de ventas
  ventasHoy?: VentaDiaria[]; // ventas del día, para comparar el cierre por vendedor
}

interface ProductoIPVE extends Producto {
  inicio: number;
  entrada: number;
  final: number;
}

export default function IPVE({ open, onOpenChange, user, modoDiario = false, totalCierre, ventasHoy }: IPVEProps) {
  const { vendedores, getVendedorByNombre } = useVendedores();
  const { productos } = useProductos();
  const { getRegistrosDiariosByFecha, getRegistrosByFecha, getRegistrosHistoricosByFecha, agregarOActualizarRegistro } = useRegistrosIPVE();
  const { agregarPedido } = usePedidos();
  
  const vendedorPrederminado = useMemo(() => {
    if (!user || user.role === 'jefe' || user.role === 'admin') return '';
    return getVendedorByNombre(user.nombre)?.id || '';
  }, [user, getVendedorByNombre]);
  
  const [vendedorId, setVendedorId] = useState<string>(vendedorPrederminado);
  const [vendedorIdTemporal, setVendedorIdTemporal] = useState<string>('');
  const hoyLocal = new Date();
  const fecha = `${hoyLocal.getFullYear()}-${String(hoyLocal.getMonth() + 1).padStart(2, '0')}-${String(hoyLocal.getDate()).padStart(2, '0')}`;
  const [productosIPVE, setProductosIPVE] = useState<ProductoIPVE[]>([]);
  const [saved, setSaved] = useState(false);
  const [guardarVendedorOpen, setGuardarVendedorOpen] = useState(false);
  const [alerta, setAlerta] = useState<'faltante' | 'sobrante' | null>(null);
  const [reposicionOpen, setReposicionOpen] = useState(false);
  const [reposicionItems, setReposicionItems] = useState<Record<string, number>>({});

  const selectedVendedor = useMemo(() => 
    vendedores.find(v => v.id === vendedorId), 
  [vendedorId, vendedores]);

  // Productos que necesitan reposición (final <= stockMinimo o final = 0)
  const productosParaReposicion = useMemo(() => {
    return productosIPVE.filter(p => {
      const producto = productos.find(prod => prod.id === p.id);
      if (!producto) return false;
      return p.final <= producto.stockMinimo && (p.inicio > 0 || p.entrada > 0);
    });
  }, [productosIPVE, productos]);

  // Helper to get previous day's date in YYYY-MM-DD format
  const getPreviousDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };

  const initializeProductos = () => {
    if (!vendedorId) {
      const inicial = productos.map(p => ({
        ...p,
        inicio: 0,
        entrada: 0,
        final: 0,
      }));
      setProductosIPVE(inicial);
      setSaved(false);
      return;
    }
    
    // Buscar registros DEL DÍA ACTUAL y del TIPO apropiado
    const tipoBuscado = modoDiario ? 'diario' : 'historico';
    const diarios = getRegistrosDiariosByFecha(fecha).filter(r => r.vendedorId === vendedorId);
    const historicos = getRegistrosByFecha(fecha).filter(r => r.vendedorId === vendedorId);
    
    // En modo diario buscar solo diarios, en modo histórico solo históricos
    const existentes = modoDiario 
      ? diarios.filter(r => r.tipo === 'diario')
      : historicos.filter(r => r.tipo === 'historico');
    
    console.log('Inicializando IPVE:', { fecha, vendedorId, tipoBuscado, diarios: diarios.length, historicos: historicos.length, existentes: existentes.length });
    
    // Si no hay registros para hoy, buscar el histórico del día anterior para continuidad
    let historicosAyer: RegistroIPVE[] = [];
    if (existentes.length === 0) {
      const fechaAyer = getPreviousDate(fecha);
      historicosAyer = getRegistrosHistoricosByFecha(fechaAyer).filter(r => r.vendedorId === vendedorId);
      console.log('Buscando histórico de ayer para continuidad:', { fechaAyer, encontrados: historicosAyer.length });
    }
    
    const inicial = productos.map(p => {
      const exist = existentes.find(e => e.productoId === p.id);
      if (exist) {
        // Ya existe registro para hoy, usar sus valores
        return {
          ...p,
          inicio: exist.inicio || 0,
          entrada: exist.entrada || 0,
          final: exist.final || 0,
        };
      }
      
      // No hay registro para hoy, buscar en histórico de ayer
      const historicoAyer = historicosAyer.find(h => h.productoId === p.id);
      const inicioDesdeAyer = historicoAyer?.final ?? 0;
      
      // Solo aplicar continuidad si hay histórico de ayer (no es el primer día)
      const hayHistoricoPrevio = historicosAyer.length > 0;
      const inicio = hayHistoricoPrevio ? inicioDesdeAyer : 0;
      
      return {
        ...p,
        inicio,
        entrada: 0,
        final: 0,
      };
    });
    
    setProductosIPVE(inicial);
    setSaved(existentes.length > 0);
  };

  useEffect(() => {
    if (open) {
      initializeProductos();
    }
    if (!open) {
      setProductosIPVE([]);
      setSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && vendedorId) {
      initializeProductos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedorId]);

  // Si el diálogo se abre antes de que los productos terminen de cargar
  // (red lenta / móvil), reinicializar cuando lleguen — sin borrar ediciones.
  useEffect(() => {
    if (open && productos.length > 0 && productosIPVE.length === 0) {
      initializeProductos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos]);

  const updateProducto = (productoId: string, field: 'inicio' | 'entrada' | 'final', value: number) => {
    setProductosIPVE(prev => prev.map(p => {
      if (p.id === productoId) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const isToday = fecha === `${hoyLocal.getFullYear()}-${String(hoyLocal.getMonth() + 1).padStart(2, '0')}-${String(hoyLocal.getDate()).padStart(2, '0')}`;

  const handleSave = async () => {
    if (!isToday) return;

    const currentVendedorId = vendedorId || vendedorIdTemporal;
    const currentVendedor = vendedores.find(v => v.id === currentVendedorId);

    if (!currentVendedorId || !currentVendedor) {
      setGuardarVendedorOpen(true);
      return;
    }

    const tipo: 'diario' | 'historico' = modoDiario ? 'diario' : 'historico';

    const registrosNuevos = productosIPVE.map(p => ({
      fecha,
      vendedorId: currentVendedorId,
      vendedorNombre: currentVendedor.nombre,
      productoId: p.id,
      productoNombre: p.nombre,
      inicio: p.inicio,
      entrada: p.entrada,
      final: p.final,
      precioVenta: p.precioVenta,
      tipo,
    }));

    for (const registro of registrosNuevos) {
      await agregarOActualizarRegistro(registro);
    }
    setSaved(true);
    // Validar importe IPVE contra registro de cierre
    validarCierre();
    toast.success('IPVE guardado');
  };

const handleConfirmarGuardarConVendedor = async () => {
    if (!vendedorIdTemporal) return;

    const currentVendedor = vendedores.find(v => v.id === vendedorIdTemporal);
    if (!currentVendedor) return;

    const tipo: 'diario' | 'historico' = modoDiario ? 'diario' : 'historico';

    const registrosNuevos = productosIPVE.map(p => ({
      fecha,
      vendedorId: vendedorIdTemporal,
      vendedorNombre: currentVendedor.nombre,
      productoId: p.id,
      productoNombre: p.nombre,
      inicio: p.inicio,
      entrada: p.entrada,
      final: p.final,
      precioVenta: p.precioVenta,
      tipo,
    }));

    for (const registro of registrosNuevos) {
      await agregarOActualizarRegistro(registro);
    }
    setSaved(true);
    setGuardarVendedorOpen(false);
    setVendedorIdTemporal('');
    toast.success('IPVE guardado');
  };

  const handleGuardarDia = async () => {
    if (!isToday) return;

    const currentVendedorId = vendedorId || vendedorIdTemporal;
    const currentVendedor = vendedores.find(v => v.id === currentVendedorId);
    if (!currentVendedorId || !currentVendedor) {
      setGuardarVendedorOpen(true);
      return;
    }

    for (const p of productosIPVE) {
      // Guardar como diario
      await agregarOActualizarRegistro({
        fecha,
        vendedorId: currentVendedorId,
        vendedorNombre: currentVendedor.nombre,
        productoId: p.id,
        productoNombre: p.nombre,
        inicio: p.inicio,
        entrada: p.entrada,
        final: p.final,
        precioVenta: p.precioVenta,
        tipo: 'diario'
      });
      // Guardar como histórico
      await agregarOActualizarRegistro({
        fecha,
        vendedorId: currentVendedorId,
        vendedorNombre: currentVendedor.nombre,
        productoId: p.id,
        productoNombre: p.nombre,
        inicio: p.inicio,
        entrada: p.entrada,
        final: p.final,
        precioVenta: p.precioVenta,
        tipo: 'historico'
      });
    }
    setSaved(true);
    // Validar importe IPVE contra registro de cierre
    validarCierre();
    toast.success('Día guardado completamente');
    
    // Abrir diálogo de reposición si hay productos que la necesitan
    const itemsNecesitanReposicion = productosParaReposicion;
    if (itemsNecesitanReposicion.length > 0) {
      const initialItems: Record<string, number> = {};
      itemsNecesitanReposicion.forEach(p => {
        const producto = productos.find(prod => prod.id === p.id);
        if (producto) {
          // Sugerir cantidad para llegar al stock mínimo + buffer
          const sugerida = Math.max(0, producto.stockMinimo - p.final + 5);
          initialItems[p.id] = sugerida;
        }
      });
      setReposicionItems(initialItems);
      setReposicionOpen(true);
    }
  };

  const handleSubmitReposicion = async () => {
    const currentVendedorId = vendedorId || vendedorIdTemporal;
    if (!currentVendedorId || !user) return;
    
    const currentVendedor = vendedores.find(v => v.id === currentVendedorId);
    if (!currentVendedor) return;

    const itemsToRequest = Object.entries(reposicionItems).filter(([, qty]) => qty > 0);
    
    for (const [productoId, cantidad] of itemsToRequest) {
      const producto = productos.find(p => p.id === productoId);
      if (!producto) continue;
      
      const ipveProducto = productosIPVE.find(p => p.id === productoId);
      const finalActual = ipveProducto?.final ?? 0;
      
      await agregarPedido({
        vendedorId: currentVendedorId,
        vendedorNombre: currentVendedor.nombre,
        productoId,
        productoNombre: producto.nombre,
        cantidad,
        notas: `[REPOSICION] Stock final: ${finalActual} (mín: ${producto.stockMinimo}) - Solicitud automática tras guardar día`,
        estado: 'pendiente',
      });
    }
    
    if (itemsToRequest.length > 0) {
      toast.success(`${itemsToRequest.length} solicitud(es) de reposición enviada(s)`);
    } else {
      toast.info('No se solicitaron productos');
    }
    
    setReposicionOpen(false);
    setReposicionItems({});
  };

  const updateReposicionItem = (productoId: string, value: number) => {
    setReposicionItems(prev => ({ ...prev, [productoId]: Math.max(0, value) }));
  };

  const totales = useMemo(() => {
    return productosIPVE.reduce((acc, p) => {
      const vendido = (p.inicio + p.entrada) - p.final;
      const importe = vendido * p.precioVenta;
      return {
        inicio: acc.inicio + p.inicio,
        entrada: acc.entrada + p.entrada,
        final: acc.final + p.final,
        vendido: acc.vendido + vendido,
        importe: acc.importe + importe,
      };
    }, { inicio: 0, entrada: 0, final: 0, vendido: 0, importe: 0 });
  }, [productosIPVE]);

  // Cierre a comparar: con vendedor seleccionado, el cierre de SUS ventas del día;
  // sin vendedor, el total del día (totalCierre por compatibilidad).
  const cierreComparacion = useMemo(() => {
    if (ventasHoy !== undefined) {
      const delVendedor = selectedVendedor
        ? ventasHoy.filter(v => v.vendedorId === selectedVendedor.id)
        : ventasHoy;
      return delVendedor.reduce((sum, v) => sum + v.totalVendido, 0);
    }
    return totalCierre;
  }, [ventasHoy, selectedVendedor, totalCierre]);

  const validarCierre = () => {
    if (cierreComparacion === undefined) return;
    const diferencia = Math.round((totales.importe - cierreComparacion) * 100) / 100;
    if (diferencia > 0) {
      setAlerta('sobrante');
    } else if (diferencia < 0) {
      setAlerta('faltante');
    } else {
      setAlerta(null);
    }
  };

  useEffect(() => {
    if (cierreComparacion !== undefined) {
      validarCierre();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totales.importe, cierreComparacion]);

  const handlePrint = () => {
    const printContent = generatePrintContent();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExportWord = () => {
    const content = generateWordContent();
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IPVE_${fecha}_${selectedVendedor?.nombre || 'vendedor'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatePrintContent = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>IPVE - ${fecha}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: center; }
          th { background: #f0f0f0; }
          .totales { font-weight: bold; background: #f0f0f0; }
        </style>
      </head>
      <body>
        <h1>IPVE - ${fecha}</h1>
        <p><strong>Vendedor:</strong> ${selectedVendedor?.nombre}</p>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Inicio</th>
              <th>Entrada</th>
              <th>Final</th>
              <th>Vendido</th>
              <th>Precio</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            ${productosIPVE.filter(p => p.inicio > 0 || p.entrada > 0 || p.final > 0).map(p => {
              const vendido = (p.inicio + p.entrada) - p.final;
              const importe = vendido * p.precioVenta;
              return `
                <tr>
                  <td>${p.nombre}</td>
                  <td>${p.inicio}</td>
                  <td>${p.entrada}</td>
                  <td>${p.final}</td>
                  <td>${vendido}</td>
                  <td>${formatCurrency(p.precioVenta)}</td>
                  <td>${formatCurrency(importe)}</td>
                </tr>
              `;
            }).join('')}
            <tr class="totales">
              <td><strong>TOTAL</strong></td>
              <td><strong>${totales.inicio}</strong></td>
              <td><strong>${totales.entrada}</strong></td>
              <td><strong>${totales.final}</strong></td>
              <td><strong>${totales.vendido}</strong></td>
              <td></td>
              <td><strong>${formatCurrency(totales.importe)}</strong></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
  };

  const generateWordContent = () => {
    const rows = productosIPVE
      .filter(p => p.inicio > 0 || p.entrada > 0 || p.final > 0)
      .map(p => {
        const vendido = (p.inicio + p.entrada) - p.final;
        const importe = vendido * p.precioVenta;
        return `${p.nombre}\t${p.inicio}\t${p.entrada}\t${p.final}\t${vendido}\t${formatCurrency(p.precioVenta)}\t${formatCurrency(importe)}`;
      })
      .join('\n');

    const header = 'Producto\tInicio\tEntrada\tFinal\tVendido\tPrecio\tImporte';
    const totalRow = `TOTAL\t${totales.inicio}\t${totales.entrada}\t${totales.final}\t${totales.vendido}\t\t${formatCurrency(totales.importe)}`;
    
    return `IPVE - ${fecha}\nVendedor: ${selectedVendedor?.nombre}\n\n${header}\n${rows}\n${totalRow}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>IPVE - Inventario de Productos en Venta</DialogTitle>
            <DialogDescription>
              Ingrese el inventario de productos en venta del día
            </DialogDescription>
            {alerta === 'sobrante' && cierreComparacion !== undefined && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-left">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-foreground">Sobrante detectado</p>
                  <p className="text-sm text-muted-foreground">El importe del IPVE (${totales.importe}) excede el total del registro de cierre (${cierreComparacion}). Verifique los datos.</p>
                </div>
              </div>
            )}
            {alerta === 'faltante' && cierreComparacion !== undefined && (
              <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-left">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-foreground">Faltante detectado</p>
                  <p className="text-sm text-muted-foreground">El importe del IPVE (${totales.importe}) es menor al total del registro de cierre (${cierreComparacion}). Faltan ${Math.abs(totales.importe - cierreComparacion)}.</p>
                </div>
              </div>
            )}
            {alerta === null && cierreComparacion !== undefined && (
              <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-3 text-left">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-foreground">IPVE coincide con el registro de cierre</p>
                  <p className="text-sm text-muted-foreground">El importe del IPVE (${totales.importe}) coincide exactamente con el total del registro de cierre.</p>
                </div>
              </div>
            )}
          </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Fecha: {fecha}</Label>
              <p className="text-sm text-muted-foreground">Día actual</p>
            </div>
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={vendedorId} onValueChange={setVendedorId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccione vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {productosIPVE.length > 0 ? (
            <>
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Inicio</TableHead>
                      <TableHead className="text-right">Entrada</TableHead>
                      <TableHead className="text-right">Final</TableHead>
                      <TableHead className="text-right">Vendido</TableHead>
                      <TableHead className="text-right">Precio Venta</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosIPVE.map(producto => {
                      const vendido = (producto.inicio + producto.entrada) - producto.final;
                      const importe = vendido * producto.precioVenta;
                      
                      return (
                        <TableRow key={producto.id}>
                          <TableCell className="font-medium">{producto.nombre}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              value={producto.inicio}
                              onChange={(e) => updateProducto(producto.id, 'inicio', parseInt(e.target.value) || 0)}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              value={producto.entrada}
                              onChange={(e) => updateProducto(producto.id, 'entrada', parseInt(e.target.value) || 0)}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              value={producto.final}
                              onChange={(e) => updateProducto(producto.id, 'final', parseInt(e.target.value) || 0)}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">{vendido}</TableCell>
                          <TableCell className="text-right">{formatCurrency(producto.precioVenta)}</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(importe)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{totales.inicio}</TableCell>
                      <TableCell className="text-right">{totales.entrada}</TableCell>
                      <TableCell className="text-right">{totales.final}</TableCell>
                      <TableCell className="text-right">{totales.vendido}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{formatCurrency(totales.importe)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline"
                  onClick={handlePrint}
                  disabled={!isToday}
                >
                  <Printer aria-hidden />
                  Imprimir
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleExportWord}
                  disabled={!isToday}
                >
                  <File aria-hidden />
                  Exportar Word
                </Button>
                <ActionButton 
                  onAction={handleSave}
                  disabled={!isToday}
                  variant={modoDiario ? "default" : "outline"}
                  successMessage="Guardado"
                >
                  <Save aria-hidden />
                  {saved && !modoDiario ? 'Guardado' : isToday ? 'Guardar' : 'No editable'}
                </ActionButton>
                {modoDiario && (
                  <ActionButton 
                    onAction={handleGuardarDia}
                    disabled={!isToday}
                    variant="default"
                    className="bg-success text-success-foreground hover:bg-success/90"
                    successMessage="Día guardado"
                  >
                    <Save aria-hidden />
                    Guardar Día
                  </ActionButton>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Package}
              title="Sin productos para inventariar"
              description="Cuando haya productos configurados, registra aquí el inicio, entrada y final de cada uno."
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X aria-hidden />
            Cerrar
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={guardarVendedorOpen} onOpenChange={setGuardarVendedorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccionar Vendedor</DialogTitle>
            <DialogDescription>
              Seleccione el vendedor para guardar el IPVE
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={vendedorIdTemporal} onValueChange={setVendedorIdTemporal}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione vendedor" />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setGuardarVendedorOpen(false);
                setVendedorIdTemporal('');
              }}
            >
              Cancelar
            </Button>
            <ActionButton 
              onAction={handleConfirmarGuardarConVendedor}
              disabled={!vendedorIdTemporal}
              successMessage="Guardado"
            >
              Guardar
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reposicionOpen} onOpenChange={(open) => { if (!open) setReposicionItems({}); setReposicionOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar Reposición</DialogTitle>
            <DialogDescription>
              Los siguientes productos tienen stock bajo (final ≤ stock mínimo). Ajuste las cantidades a solicitar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Stock Mín</TableHead>
                    <TableHead className="text-right">Final Actual</TableHead>
                    <TableHead className="text-right">Sugerido</TableHead>
                    <TableHead className="text-right">A Solicitar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosParaReposicion.map(producto => {
                    const prodInfo = productos.find(p => p.id === producto.id);
                    const sugerido = prodInfo ? Math.max(0, prodInfo.stockMinimo - producto.final + 5) : 0;
                    const cantidadActual = reposicionItems[producto.id] ?? sugerido;
                    
                    return (
                      <TableRow key={producto.id}>
                        <TableCell className="font-medium">{producto.nombre}</TableCell>
                        <TableCell className="text-right">{prodInfo?.stockMinimo ?? 0}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">{producto.final}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{sugerido}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            value={cantidadActual}
                            onChange={(e) => updateReposicionItem(producto.id, parseInt(e.target.value) || 0)}
                            className="w-24 text-right"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReposicionOpen(false)}>
              <X aria-hidden />
              Cancelar
            </Button>
            <ActionButton 
              onAction={handleSubmitReposicion}
              disabled={Object.values(reposicionItems).every(v => v === 0)}
              successMessage="Solicitudes enviadas"
            >
              <ArrowUpCircle aria-hidden />
              Enviar Solicitudes
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}