import { useState, useMemo, useEffect } from 'react';
import { File, Printer, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useVendedores, useProductos, useIPVE, formatCurrency } from '@/hooks/useStorage';
import type { User } from '@/hooks/useAuth';
import type { Producto } from '@/types';

interface IPVEProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  modoDiario?: boolean;
}

interface ProductoIPVE extends Producto {
  inicio: number;
  entrada: number;
  final: number;
}

export default function IPVE({ open, onOpenChange, user, modoDiario = false }: IPVEProps) {
  const { vendedores, getVendedorByNombre } = useVendedores();
  const { productos } = useProductos();
  const { guardarRegistrosIPVE, guardarIPVEDiarioYHistorico, getRegistrosByFecha, getRegistrosDiariosByFecha } = useIPVE();
  
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

  const selectedVendedor = useMemo(() => 
    vendedores.find(v => v.id === vendedorId), 
  [vendedorId, vendedores]);

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
    
    const inicial = productos.map(p => {
      const exist = existentes.find(e => e.productoId === p.id);
      return {
        ...p,
        inicio: exist?.inicio || 0,
        entrada: exist?.entrada || 0,
        final: exist?.final || 0,
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
  }, [open]);

  useEffect(() => {
    if (open && vendedorId) {
      initializeProductos();
    }
  }, [vendedorId]);

  const updateProducto = (productoId: string, field: 'inicio' | 'entrada' | 'final', value: number) => {
    setProductosIPVE(prev => prev.map(p => {
      if (p.id === productoId) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const isToday = fecha === `${hoyLocal.getFullYear()}-${String(hoyLocal.getMonth() + 1).padStart(2, '0')}-${String(hoyLocal.getDate()).padStart(2, '0')}`;

  const handleSave = () => {
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

    guardarRegistrosIPVE(registrosNuevos);
    setSaved(true);
  };

const handleConfirmarGuardarConVendedor = () => {
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

    guardarRegistrosIPVE(registrosNuevos);
    setSaved(true);
    setGuardarVendedorOpen(false);
    setVendedorIdTemporal('');
  };

  const handleGuardarDia = () => {
    if (!isToday) return;
    
    const currentVendedorId = vendedorId || vendedorIdTemporal;
    const currentVendedor = vendedores.find(v => v.id === currentVendedorId);
    if (!currentVendedorId || !currentVendedor) {
      setGuardarVendedorOpen(true);
      return;
    }
    
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
    }));

    guardarIPVEDiarioYHistorico(registrosNuevos);
    setSaved(true);
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

          {productosIPVE.length > 0 && (
            <>
              <div className="border rounded-lg overflow-hidden">
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
                    <TableRow className="bg-slate-100 font-bold">
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
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleExportWord}
                  disabled={!isToday}
                >
                  <File className="w-4 h-4 mr-2" />
                  Exportar Word
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={!isToday}
                  variant={modoDiario ? "default" : "outline"}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saved && !modoDiario ? 'Guardado' : isToday ? 'Guardar' : 'No editable'}
                </Button>
                {modoDiario && (
                  <Button 
                    onClick={handleGuardarDia}
                    disabled={!isToday}
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Día
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
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
            <Button 
              onClick={handleConfirmarGuardarConVendedor} 
              disabled={!vendedorIdTemporal}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}