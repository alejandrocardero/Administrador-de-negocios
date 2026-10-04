import { useState, useEffect, useRef } from 'react';
import { 
  Settings, Building2, Save, Loader2
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
import { useConfiguracion } from '@/hooks/supabase/useSupabaseData';

type ConfigRow = NonNullable<ReturnType<typeof useConfiguracion>['config']>;

const emptyConfig: ConfigRow = {
  business_id: '',
  nombre: '',
  nit: null,
  direccion: null,
  telefono: null,
  email: null,
  regimen: '',
  tarifa_iva: 0,
  moneda: '',
  created_at: '',
  updated_at: '',
};

export default function Configuracion() {
  const { config, loading, updateConfig } = useConfiguracion();
  const [formData, setFormData] = useState<ConfigRow>(config ?? emptyConfig);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && config) {
      initializedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(config);
    }
  }, [config]);

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
    if (formData) {
      await updateConfig(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="empresa">
        <TabsList className="mb-4">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="impuestos">Impuestos</TabsTrigger>
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
                    value={formData.nit ?? ''}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                    placeholder="NIT de la empresa"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion ?? ''}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Dirección completa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono ?? ''}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Teléfono de contacto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email ?? ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
                    value={formData.tarifa_iva}
                    onChange={(e) => setFormData({ ...formData, tarifa_iva: parseFloat(e.target.value) || 0 })}
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
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
