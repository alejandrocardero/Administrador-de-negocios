import { useState } from 'react';
import { 
  Settings, Building2, Save, Database, Download, Upload, Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfiguracion } from '@/hooks/useStorage';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '@/components/ui/dialog';

export default function Configuracion() {
  const { configuracion, actualizarConfiguracion } = useConfiguracion();
  const [formData, setFormData] = useState(configuracion);
  const [saved, setSaved] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [limpiarIPVEOpen, setLimpiarIPVEOpen] = useState(false);

  const handleSave = () => {
    actualizarConfiguracion(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleExportData = () => {
    const data = {
      productos: localStorage.getItem('productos'),
      vendedores: localStorage.getItem('vendedores'),
      compradores: localStorage.getItem('compradores'),
      ventas: localStorage.getItem('ventas'),
      compras: localStorage.getItem('compras'),
      gastos: localStorage.getItem('gastos'),
      impuestos: localStorage.getItem('impuestos'),
      configuracion: localStorage.getItem('configuracion'),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const hoy = new Date();
    a.download = `backup-adminnegocio-${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          Object.entries(data).forEach(([key, value]) => {
            if (value) {
              localStorage.setItem(key, value as string);
            }
          });
          alert('Datos importados correctamente. La página se recargará.');
          window.location.reload();
        } catch (error) {
          alert('Error al importar los datos. Verifique el archivo.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleResetData = () => {
    localStorage.clear();
    setResetDialogOpen(false);
    alert('Todos los datos han sido eliminados. La página se recargará.');
    window.location.reload();
  };

  const handleLimpiarIPVE = () => {
    if (confirm('¿Está seguro de que desea eliminar todo el historial de IPVE? Esta acción no se puede deshacer.')) {
      localStorage.removeItem('registrosIPVE');
      setLimpiarIPVEOpen(false);
      alert('Historial de IPVE eliminado correctamente.');
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="empresa">
        <TabsList className="mb-4">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="impuestos">Impuestos</TabsTrigger>
          <TabsTrigger value="datos">Datos</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Información de la Empresa
              </CardTitle>
              <CardDescription>
                Configure los datos de su negocio que aparecerán en los documentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {saved && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-700">
                    Configuración guardada correctamente
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre del Negocio *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Nombre de su negocio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nit">NIT *</Label>
                  <Input
                    id="nit"
                    value={formData.nit}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                    placeholder="NIT de la empresa"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Dirección completa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Teléfono de contacto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impuestos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuración de Impuestos
              </CardTitle>
              <CardDescription>
                Configure el régimen tributario y tasas de impuestos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {saved && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-700">
                    Configuración guardada correctamente
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="regimen">Régimen Tributario</Label>
                  <Select 
                    value={formData.regimen} 
                    onValueChange={(value) => setFormData({ ...formData, regimen: value as 'simplificado' | 'comun' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simplificado">Régimen Simplificado</SelectItem>
                      <SelectItem value="comun">Régimen Común</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tarifaIva">Tarifa IVA (%)</Label>
                  <Input
                    id="tarifaIva"
                    type="number"
                    value={formData.tarifaIva}
                    onChange={(e) => setFormData({ ...formData, tarifaIva: parseFloat(e.target.value) || 0 })}
                    placeholder="19"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="moneda">Moneda</Label>
                  <Select 
                    value={formData.moneda} 
                    onValueChange={(value) => setFormData({ ...formData, moneda: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COP">Peso Colombiano (COP)</SelectItem>
                      <SelectItem value="USD">Dólar (USD)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="datos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Gestión de Datos
              </CardTitle>
              <CardDescription>
                Exporte, importe o elimine los datos de la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Download className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Exportar Datos</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Descargue una copia de seguridad de todos sus datos
                        </p>
                      </div>
                      <Button onClick={handleExportData} variant="outline" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <Upload className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Importar Datos</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Restaure sus datos desde un archivo de respaldo
                        </p>
                      </div>
                      <div className="w-full">
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportData}
                          className="hidden"
                          id="import-file"
                        />
                        <label htmlFor="import-file">
                          <Button variant="outline" className="w-full" asChild>
                            <span>
                              <Upload className="w-4 h-4 mr-2" />
                              Importar
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-red-200">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <Trash2 className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-red-700">Zona de Peligro</h3>
                        <p className="text-sm text-slate-500">
                          Eliminar todos los datos de la aplicación
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="destructive" 
                      onClick={() => setResetDialogOpen(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar Todo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-200">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                        <Trash2 className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-orange-700">Limpiar IPVE</h3>
                        <p className="text-sm text-slate-500">
                          Eliminar todo el historial de IPVE (diario e histórico)
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                      onClick={() => setLimpiarIPVEOpen(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpiar IPVE
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmación para eliminar datos */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Eliminar Todos los Datos
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente todos los datos de la aplicación, 
              incluyendo productos, ventas, vendedores, compradores y configuración. 
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleResetData}>
              <Trash2 className="w-4 h-4 mr-2" />
              Sí, Eliminar Todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={limpiarIPVEOpen} onOpenChange={setLimpiarIPVEOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Limpiar Historial IPVE
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará todo el historial de IPVE, tanto diário como histórico. 
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimpiarIPVEOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="outline"
              className="border-orange-500 text-orange-600"
              onClick={handleLimpiarIPVE}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Sí, Eliminar IPVE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
