import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { Edit, Trash2, Loader2, Settings, Zap, Gift, Calendar, Layers, ArrowUpDown, Package, Plus } from 'lucide-react';

const ruleTypeSchema = z.enum(['POR_MONTO', 'POR_PRODUCTO', 'POR_CATEGORIA', 'PRIMERA_COMPRA', 'CUMPLEANOS', 'RANGO_MONTO']);

const ruleSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  type: ruleTypeSchema,
  config: z.record(z.unknown()),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  productIds: z.array(z.string()).optional(),
});

type RuleForm = z.infer<typeof ruleSchema>;

interface PointRule {
  id: string;
  name: string;
  description?: string;
  type: RuleType;
  config: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
  products?: Array<{ id: string; name: string }>;
}

type RuleType = 'POR_MONTO' | 'POR_PRODUCTO' | 'POR_CATEGORIA' | 'PRIMERA_COMPRA' | 'CUMPLEANOS' | 'RANGO_MONTO';

const typeLabels: Record<RuleType, string> = {
  POR_MONTO: 'Por Monto',
  POR_PRODUCTO: 'Por Producto',
  POR_CATEGORIA: 'Por Categoría',
  PRIMERA_COMPRA: 'Primera Compra',
  CUMPLEANOS: 'Cumpleaños',
  RANGO_MONTO: 'Por Rangos',
};

const typeIcons: Record<RuleType, React.ComponentType<{ className?: string }>> = {
  POR_MONTO: Zap,
  POR_PRODUCTO: Package,
  POR_CATEGORIA: Layers,
  PRIMERA_COMPRA: Gift,
  CUMPLEANOS: Calendar,
  RANGO_MONTO: ArrowUpDown,
};

const RuleTypeIcon = ({ type, className }: { type: RuleType; className?: string }) => {
  const Icon = typeIcons[type];
  return <Icon className={className} />;
};

const defaultConfigs: Record<RuleType, Record<string, unknown>> = {
  POR_MONTO: { puntosPorMonto: 100, montoMinimo: 1000, multiplicador: 1 },
  POR_PRODUCTO: { productosIds: [], multiplicador: 1 },
  POR_CATEGORIA: { categorias: [], multiplicador: 1 },
  PRIMERA_COMPRA: { bonusPrimeraCompra: 500 },
  CUMPLEANOS: { bonusCumpleanos: 200 },
  RANGO_MONTO: { rangos: [{ min: 0, max: 50000, puntos: 100 }, { min: 50001, max: 100000, puntos: 250 }, { min: 100001, max: 999999, puntos: 500 }] },
};

export default function PointRules() {
  // Rules state
  const [rules, setRules] = useState<PointRule[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PointRule | null>(null);

  const form = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'POR_MONTO',
      config: defaultConfigs.POR_MONTO,
      priority: 0,
      isActive: true,
      validFrom: '',
      validTo: '',
      productIds: [],
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, productsRes] = await Promise.all([
        api.get<{ rules: PointRule[]; pagination: any }>('/point-rules?limit=100'),
        api.get<{ products: Array<{ id: string; name: string; code: string }> }>('/products?isActive=true&limit=200'),
      ]);
      setRules(rulesRes.data.rules);
      setProducts(productsRes.data.products);
    } catch {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const type = form.watch('type');
    form.setValue('config', defaultConfigs[type as RuleType] || defaultConfigs.POR_MONTO, { shouldDirty: true });
  }, []);

  const handleSubmit = async (data: RuleForm) => {
    setSaving(true);
    setError('');
    try {
      if (editingRule) {
        await api.put(`/point-rules/${editingRule.id}`, data);
      } else {
        await api.post('/point-rules', data);
      }
      setShowModal(false);
      setEditingRule(null);
      form.reset({ name: '', description: '', type: 'POR_MONTO', config: defaultConfigs.POR_MONTO, priority: 0, isActive: true });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/point-rules/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const openCreate = () => {
    setEditingRule(null);
    form.reset({ name: '', description: '', type: 'POR_MONTO', config: defaultConfigs.POR_MONTO, priority: 0, isActive: true, validFrom: '', validTo: '', productIds: [] });
    setShowModal(true);
  };

  const openEdit = (rule: PointRule) => {
    setEditingRule(rule);
    form.reset({
      name: rule.name,
      description: rule.description || '',
      type: rule.type,
      config: rule.config,
      priority: rule.priority,
      isActive: rule.isActive,
      validFrom: rule.validFrom ? rule.validFrom.split('T')[0] : '',
      validTo: rule.validTo ? rule.validTo.split('T')[0] : '',
      productIds: rule.products?.map(p => p.id) || [],
    });
    setShowModal(true);
  };

  interface RangoConfig {
    min: number;
    max: number;
    puntos: number;
  }

  const renderConfigEditor = () => {
    const config = form.watch('config') || {};
    const type = form.watch('type');
    const rangos = (config.rangos as RangoConfig[] || []) as RangoConfig[];

    switch (type) {
      case 'POR_MONTO':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Puntos por $</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                {...form.register('config.puntosPorMonto', { valueAsNumber: true })}
                className="input"
                defaultValue={100}
              />
              <p className="text-xs text-gray-500 mt-1">Ej: 0.5 = 1 punto cada $2</p>
            </div>
            <div>
              <label className="label">Monto Mínimo</label>
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register('config.montoMinimo', { valueAsNumber: true })}
                className="input"
                defaultValue={1000}
              />
            </div>
            <div>
              <label className="label">Multiplicador</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                {...form.register('config.multiplicador', { valueAsNumber: true })}
                className="input"
                defaultValue={1}
              />
            </div>
          </div>
        );
      case 'POR_PRODUCTO':
        return (
          <div>
            <label className="label">Productos (doble click para seleccionar)</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {products.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    {...form.register('config.productosIds')}
                    value={p.id}
                    className="rounded"
                  />
                  <span className="text-sm">{p.code} - {p.name}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="label">Multiplicador</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                {...form.register('config.multiplicador', { valueAsNumber: true })}
                className="input"
                defaultValue={1}
              />
            </div>
          </div>
        );
      case 'POR_CATEGORIA':
        return (
          <div>
            <label className="label">Categorías</label>
            <div className="flex flex-wrap gap-2">
              {['Barnices', 'Bases Agua', 'Catalizadores', 'Diluyentes', 'Masillas', 'Aparejos', 'Limpieza'].map(cat => (
                <label key={cat} className="flex items-center gap-1 p-1 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    {...form.register('config.categorias')}
                    value={cat}
                    className="rounded"
                  />
                  <span className="text-sm">{cat}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="label">Multiplicador</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                {...form.register('config.multiplicador', { valueAsNumber: true })}
                className="input"
                defaultValue={1}
              />
            </div>
          </div>
        );
      case 'PRIMERA_COMPRA':
        return (
          <div>
            <label className="label">Puntos de Bienvenida</label>
            <input
              type="number"
              min="1"
              {...form.register('config.bonusPrimeraCompra', { valueAsNumber: true })}
              className="input"
              defaultValue={500}
            />
          </div>
        );
      case 'CUMPLEANOS':
        return (
          <div>
            <label className="label">Puntos de Cumpleaños</label>
            <input
              type="number"
              min="1"
              {...form.register('config.bonusCumpleanos', { valueAsNumber: true })}
              className="input"
              defaultValue={200}
            />
            <p className="text-xs text-gray-500 mt-1">Se acreditan una vez por año si el cliente compra el día de su cumpleaños</p>
          </div>
        );
      case 'RANGO_MONTO':
        return (
          <div>
            <label className="label">Rangos (min, max, puntos)</label>
            <div className="space-y-2">
              {rangos.map((rango, i) => (
                <div key={i} className="flex gap-2">
                  <input type="number" placeholder="Mín" value={rango.min} className="input w-1/3" onChange={(e) => { const newRangos = [...rangos]; newRangos[i] = { ...newRangos[i], min: Number(e.target.value) }; form.setValue('config', { ...config, rangos: newRangos }); }} />
                  <input type="number" placeholder="Máx" value={rango.max} className="input w-1/3" onChange={(e) => { const newRangos = [...rangos]; newRangos[i] = { ...newRangos[i], max: Number(e.target.value) }; form.setValue('config', { ...config, rangos: newRangos }); }} />
                  <input type="number" placeholder="Pts" value={rango.puntos} className="input w-1/3" onChange={(e) => { const newRangos = [...rangos]; newRangos[i] = { ...newRangos[i], puntos: Number(e.target.value) }; form.setValue('config', { ...config, rangos: newRangos }); }} />
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reglas de Puntos</h1>
          <p className="text-gray-500">Configura cómo se acreditan los puntos (única fuente de puntos del sistema)</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Reglas de Puntos</h2>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Regla
          </button>
        </div>
        <div className="p-4">
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
              {rules.map((rule) => (
                <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', rule.isActive ? 'bg-primary-100' : 'bg-gray-100')}>
                      <RuleTypeIcon type={rule.type as RuleType} className={cn('w-5 h-5', rule.isActive ? 'text-primary-600' : 'text-gray-400')} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{rule.name}</p>
                      <p className="text-sm text-gray-500">{typeLabels[rule.type as RuleType] || rule.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('badge', rule.isActive ? 'badge-success' : 'badge-gray')}>
                      {rule.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                    <span className="text-sm text-gray-500">Prioridad: {rule.priority}</span>
                    <button onClick={() => openEdit(rule)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4" /></button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      disabled={deletingId === rule.id}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      {deletingId === rule.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rules.length === 0 && !loading && (
            <div className="p-12 text-center text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay reglas configuradas</p>
            </div>
          )}
        </div>
      </div>

      {/* Rules Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingRule ? 'Editar Regla' : 'Nueva Regla'}</h2>
              <button onClick={() => { setShowModal(false); setEditingRule(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input {...form.register('name')} className="input" />
                {form.formState.errors.name && <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea {...form.register('description')} rows={2} className="input" />
              </div>
              <div>
                <label className="label">Tipo de Regla</label>
                <select {...form.register('type')} className="input">
                  <option value="POR_MONTO">Por Monto</option>
                  <option value="POR_PRODUCTO">Por Producto</option>
                  <option value="POR_CATEGORIA">Por Categoría</option>
                  <option value="PRIMERA_COMPRA">Primera Compra</option>
                  <option value="CUMPLEANOS">Cumpleaños</option>
                  <option value="RANGO_MONTO">Por Rango de Monto</option>
                </select>
                {form.formState.errors.type && <p className="text-sm text-red-600 mt-1">{form.formState.errors.type.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prioridad</label>
                  <input type="number" {...form.register('priority', { valueAsNumber: true })} className="input" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...form.register('isActive')} className="rounded" />
                    <span>Activa</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Válida Desde</label>
                  <input type="date" {...form.register('validFrom')} className="input" />
                </div>
                <div>
                  <label className="label">Válida Hasta</label>
                  <input type="date" {...form.register('validTo')} className="input" />
                </div>
              </div>
              <div className="border-t pt-4">
                <label className="label">Configuración de la Regla</label>
                {renderConfigEditor()}
              </div>
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingRule(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
