import { useState, useEffect, useRef } from 'react';
import {
  Settings, Building2, Save, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfiguracion } from '@/hooks/supabase/useSupabaseData';
import { toast } from 'sonner';
import { PageHeader, LabeledInput } from '@/components/shared';

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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && config) {
      initializedRef.current = true;
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
        toast.success('Configuración guardada correctamente');
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex h-64 items-center justify-center"
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Datos de tu negocio y parámetros fiscales"
        icon={Settings}
      />

      <Tabs defaultValue="empresa">
        <TabsList className="mb-4">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="impuestos">Impuestos</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-5" aria-hidden />
                Información de la Empresa
              </CardTitle>
              <CardDescription>
                Configure los datos de su negocio que aparecerán en los documentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <LabeledInput
                  id="nombre"
                  label="Nombre del Negocio *"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre de su negocio"
                />
                <LabeledInput
                  id="nit"
                  label="NIT *"
                  value={formData.nit ?? ''}
                  onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                  placeholder="NIT de la empresa"
                />
                <div className="sm:col-span-2">
                  <LabeledInput
                    id="direccion"
                    label="Dirección"
                    value={formData.direccion ?? ''}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Dirección completa"
                  />
                </div>
                <LabeledInput
                  id="telefono"
                  label="Teléfono"
                  value={formData.telefono ?? ''}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Teléfono de contacto"
                />
                <LabeledInput
                  id="email"
                  label="Email"
                  type="email"
                  value={formData.email ?? ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  <Save className="size-4" aria-hidden />
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
                <Settings className="size-5" aria-hidden />
                Configuración de Impuestos
              </CardTitle>
              <CardDescription>
                Configure el régimen tributario y tasas de impuestos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex w-full flex-col gap-1.5">
                  <label htmlFor="regimen" className="text-sm font-medium">
                    Régimen Tributario
                  </label>
                  <Select
                    value={formData.regimen}
                    onValueChange={(value) => setFormData({ ...formData, regimen: value as 'simplificado' | 'comun' })}
                  >
                    <SelectTrigger id="regimen" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simplificado">Régimen Simplificado</SelectItem>
                      <SelectItem value="comun">Régimen Común</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <LabeledInput
                  id="tarifaIva"
                  label="Tarifa IVA (%)"
                  type="number"
                  value={formData.tarifa_iva}
                  onChange={(e) => setFormData({ ...formData, tarifa_iva: parseFloat(e.target.value) || 0 })}
                  placeholder="19"
                />
                <div className="flex w-full flex-col gap-1.5">
                  <label htmlFor="moneda" className="text-sm font-medium">
                    Moneda
                  </label>
                  <Select
                    value={formData.moneda}
                    onValueChange={(value) => setFormData({ ...formData, moneda: value })}
                  >
                    <SelectTrigger id="moneda" className="w-full">
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
                  {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  <Save className="size-4" aria-hidden />
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
