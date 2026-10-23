import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { useToast } from '../components/Toast';
import { Search, Edit, Loader2, Settings, RefreshCw, Award, Mail } from 'lucide-react';

const systemConfigSchema = z.object({
  key: z.string().min(1, 'Clave requerida'),
  value: z.record(z.unknown()),
  description: z.string().optional(),
});

type SystemConfigForm = z.infer<typeof systemConfigSchema>;

interface SystemConfig {
  key: string;
  value: Record<string, unknown>;
  description?: string;
  updatedAt: string;
}

const configCategories: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; keys: string[] }> = {
  points: {
    label: 'Puntos',
    icon: Award,
    keys: ['min_purchase_for_points', 'max_points_per_purchase', 'redemption_min_points', 'points_expiry_days', 'points_expiry_warning_days'],
  },
  notifications: {
    label: 'Notificaciones',
    icon: Mail,
    keys: ['email_notifications_enabled', 'whatsapp_notifications_enabled', 'whatsapp_templates'],
  },
  general: {
    label: 'General',
    icon: Settings,
    keys: ['company_name', 'company_logo_url', 'support_email', 'support_phone'],
  },
};

const configLabels: Record<string, string> = {
  min_purchase_for_points: 'Mínimo Compra para Puntos',
  max_points_per_purchase: 'Máx. Puntos por Compra',
  redemption_min_points: 'Mín. Puntos para Canje',
  points_expiry_days: 'Días Vencimiento Puntos',
  points_expiry_warning_days: 'Días Aviso Vencimiento',
  email_notifications_enabled: 'Emails Habilitados',
  whatsapp_notifications_enabled: 'WhatsApp Habilitado',
  whatsapp_templates: 'Plantillas de WhatsApp',
  company_name: 'Nombre Empresa',
  company_logo_url: 'URL Logo',
  support_email: 'Email Soporte',
  support_phone: 'Teléfono Soporte',
};

const configTooltips: Record<string, string> = {
  min_purchase_for_points: 'Monto mínimo de compra para que las reglas de puntos se apliquen.',
  max_points_per_purchase: 'Límite máximo de puntos que se pueden ganar en una sola compra (0 = sin límite).',
  redemption_min_points: 'Mínimo de puntos que el cliente debe tener para poder canjear un premio.',
  points_expiry_days: 'Días de inactividad para que venzan los puntos (0 = sin vencimiento).',
  points_expiry_warning_days: 'Mostrar aviso de vencimiento de puntos X días antes de expirar.',
  email_notifications_enabled: 'Activar/Desactivar el envío de emails de notificación de puntos y canjes.',
  whatsapp_notifications_enabled: 'Activar/Desactivar el envío de notificaciones por WhatsApp cuando el cliente gana puntos o canjea un premio.',
  whatsapp_templates: 'Plantillas de los mensajes automáticos de WhatsApp. Variables disponibles: {nombre}, {apellido}, {dni}, {puntos}, {total}, {premio}, {dias}, {empresa}.',
  company_name: 'Nombre de tu empresa o punto de venta que se mostrará en recibos y comunicaciones.',
  company_logo_url: 'URL pública de tu logo imagen (ej: https://tudominio.com/logo.png). Recomendado: 200x200px.',
  support_email: 'Email de contacto para soporte al cliente. Los clientes verán este email en comunicaciones.',
  support_phone: 'Número de teléfono de soporte. Formato: +5491112345678 (con código de país).',
};

const catKeys: Record<string, string> = {
  points: 'Configuración de puntos: mínimos, topes y vencimiento.',
  notifications: 'Configuración de notificaciones: emails y WhatsApp para el cliente.',
  general: 'Configuración general: nombre, logo y contactos de soporte.',
};

const configInputTypes: Record<string, 'number' | 'text' | 'email' | 'url' | 'tel' | 'boolean' | 'json'> = {
  min_purchase_for_points: 'number',
  max_points_per_purchase: 'number',
  redemption_min_points: 'number',
  points_expiry_days: 'number',
  points_expiry_warning_days: 'number',
  email_notifications_enabled: 'boolean',
  whatsapp_notifications_enabled: 'boolean',
  whatsapp_templates: 'json',
  company_name: 'text',
  company_logo_url: 'url',
  support_email: 'email',
  support_phone: 'tel',
};

const isValidJson = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

export default function SystemConfig() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('points');
  const [search, setSearch] = useState('');
  const [jsonDraft, setJsonDraft] = useState<string>('');

  const form = useForm<SystemConfigForm>({
    resolver: zodResolver(systemConfigSchema),
    defaultValues: {
      key: '',
      value: {},
      description: '',
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ configs: SystemConfig[] }>('/system-config');
      setConfigs(res.data.configs);
    } catch {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: SystemConfigForm) => {
    const type = configInputTypes[data.key];
    
    if (type === 'json') {
      try {
        JSON.parse(jsonDraft);
      } catch {
        toast('error', 'El JSON ingresado no es válido. Corrígelo antes de guardar.');
        return;
      }
    }
    
    let valueToSave = data.value;
    if (type === 'number') {
      const fieldKey = Object.keys(valueToSave)[0] || 'value';
      const raw = valueToSave[fieldKey];
      const num = Number(raw);
      valueToSave = { ...valueToSave, [fieldKey]: raw === '' || raw === null || raw === undefined || isNaN(num) ? 0 : num };
    }
    
    setSaving(true);
    try {
      await api.put(`/system-config/${data.key}`, { value: valueToSave, description: data.description });
      setShowModal(false);
      setEditingConfig(null);
      form.reset({ key: '', value: {}, description: '' });
      fetchData();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleInitializeDefaults = async () => {
    if (!confirm('Esto creará las configuraciones por defecto. ¿Continuar?')) return;
    setSaving(true);
    try {
      await api.post('/system-config/initialize-defaults');
      fetchData();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Error al inicializar');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (config: SystemConfig) => {
    setEditingConfig(config);
    form.reset({
      key: config.key,
      value: config.value,
      description: config.description || '',
    });
    setJsonDraft(JSON.stringify(config.value, null, 2));
    setShowModal(true);
  };
  
  const getCurrentValue = () => form.watch('value') as Record<string, unknown>;

  const filteredConfigs = configs.filter(c => {
    const category = Object.entries(configCategories).find(([, cat]) => cat.keys.includes(c.key));
    const matchesCategory = !activeCategory || category?.[0] === activeCategory;
    const matchesSearch = c.key.toLowerCase().includes(search.toLowerCase()) || 
                          c.description?.toLowerCase().includes(search.toLowerCase()) ||
                          configLabels[c.key]?.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderValueEditor = (key: string) => {
    const currentValue = getCurrentValue() || {};
    const type = configInputTypes[key] || 'text';
    
    switch (type) {
      case 'boolean': {
        const val = currentValue.enabled === true;
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => form.setValue('value', { ...currentValue, enabled: e.target.checked })}
              className="rounded border-gray-300 h-5 w-5"
            />
            <span>Habilitado</span>
          </label>
        );
      }
      case 'number': {
        const fieldKey = Object.keys(currentValue)[0] || 'value';
        const raw = currentValue[fieldKey];
        const val = raw === '' || raw === null || raw === undefined ? '' : String(Number(raw));
        return (
          <input
            type="number"
            min="0"
            value={val}
            onChange={(e) => form.setValue('value', { ...currentValue, [fieldKey]: e.target.value })}
            className="input"
          />
        );
      }
      case 'json': {
        return (
          <div>
            <label className="label">JSON Value</label>
            <textarea
              value={jsonDraft}
              onChange={(e) => {
                setJsonDraft(e.target.value);
                try {
                  form.setValue('value', JSON.parse(e.target.value));
                } catch {
                  // JSON intermedio inválido: se conserva el último valor válido; se valida al guardar
                }
              }}
              className="input font-mono text-sm"
              rows={4}
              placeholder='{"rate": 1, "currency": "ARS"}'
            />
            {!isValidJson(jsonDraft) && (
              <p className="text-sm text-red-600 mt-1">El JSON ingresado no es válido</p>
            )}
          </div>
        );
      }
      case 'email':
      case 'url':
      case 'tel':
      case 'text':
      default: {
        const fieldKey = Object.keys(currentValue)[0] || 'value';
        const val = String(currentValue[fieldKey] || '');
        return (
          <input
            type={type === 'email' ? 'email' : type === 'url' ? 'url' : type === 'tel' ? 'tel' : 'text'}
            value={val}
            onChange={(e) => form.setValue('value', { ...currentValue, [fieldKey]: e.target.value })}
            className="input"
          />
        );
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración del Sistema</h1>
          <p className="text-gray-500">Parámetros globales y configuraciones avanzadas</p>
        </div>
        <button onClick={handleInitializeDefaults} disabled={saving} className="btn-outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Inicializar Valores por Defecto
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar configuraciones..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {Object.entries(configCategories).map(([catKey, cat]) => (
                <button
                  key={catKey}
                  onClick={() => setActiveCategory(activeCategory === catKey ? '' : catKey)}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1',
                    activeCategory === catKey
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                  title={catKeys[catKey] || ''}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse p-4 border-b border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredConfigs.map((config) => {
              const label = configLabels[config.key] || config.key;
              const type = configInputTypes[config.key] || 'text';
              const currentValue = config.value;
              let displayValue = '';
              
              if (type === 'boolean') {
                displayValue = currentValue.enabled === true ? 'Sí' : 'No';
              } else if (type === 'number') {
                const fieldKey = Object.keys(currentValue)[0] || 'value';
                displayValue = String(currentValue[fieldKey] || '');
              } else if (type === 'json') {
                displayValue = JSON.stringify(currentValue);
              } else {
                const fieldKey = Object.keys(currentValue)[0] || 'value';
                displayValue = String(currentValue[fieldKey] || '');
              }

              return (
                <div key={config.key} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Settings className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate" title={configTooltips[config.key] || ''}>{label}</p>
                      <p className="text-sm text-gray-500 truncate" title={`Campo interno: ${config.key}`}>{config.key}</p>
                      {config.description && <p className="text-xs text-gray-400 truncate mt-1" title="Descripción adicional">{config.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <div className="text-right min-w-[200px]">
                      <p className="font-mono text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded truncate max-w-[180px]" title={configTooltips[config.key] || ''}>
                        {displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 capitalize">{type}</p>
                    </div>
                    <button onClick={() => openEdit(config)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredConfigs.length === 0 && !loading && (
          <div className="p-12 text-center text-gray-500">
            <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron configuraciones</p>
          </div>
        )}
      </div>

      {showModal && editingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Editar: {configLabels[editingConfig.key] || editingConfig.key}</h2>
              <button onClick={() => { setShowModal(false); setEditingConfig(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              <div>
                <label className="label">Clave</label>
                <input {...form.register('key')} className="input font-mono text-sm bg-gray-100" readOnly title="Clave interna de la configuración. No modificar." />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea {...form.register('description')} rows={2} className="input" title="Descripción opcional de la configuración. Visible en el panel de administración." />
              </div>
              <div className="border-t pt-4">
                <label className="label">Valor</label>
                <input type="hidden" {...form.register('value')} />
                {renderValueEditor(editingConfig.key)}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingConfig(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}