import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { Plus, Search, Edit, Trash2, Loader2, Shield, Sparkles, Gift, Zap, Calendar, CheckCircle, ChevronRight, Crown, Send } from 'lucide-react';

const benefitTypeSchema = z.enum(['DESCUENTO_PORCENTUAL', 'ENVIO_GRATIS', 'MULTIPLICADOR_PUNTOS', 'PRODUCTO_BONIFICADO', 'ACCESO_ANTICIPADO', 'REGALO_CUMPLEANOS', 'ATENCION_PRIORITARIA']);

const benefitSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().min(1, 'Descripción requerida'),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  type: benefitTypeSchema,
  value: z.number().positive('Valor requerido'),
  isActive: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  autoApply: z.boolean().default(false),
});

type BenefitForm = z.infer<typeof benefitSchema>;

interface Benefit {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  type: string;
  value: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  autoApply: boolean;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  DESCUENTO_PORCENTUAL: 'Descuento %',
  ENVIO_GRATIS: 'Envío Gratis',
  MULTIPLICADOR_PUNTOS: 'Multiplicador Puntos',
  PRODUCTO_BONIFICADO: 'Producto Bonificado',
  ACCESO_ANTICIPADO: 'Acceso Anticipado',
  REGALO_CUMPLEANOS: 'Regalo Cumpleaños',
  ATENCION_PRIORITARIA: 'Atención Prioritaria',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  DESCUENTO_PORCENTUAL: Sparkles,
  ENVIO_GRATIS: Send,
  MULTIPLICADOR_PUNTOS: Zap,
  PRODUCTO_BONIFICADO: Gift,
  ACCESO_ANTICIPADO: ChevronRight,
  REGALO_CUMPLEANOS: Calendar,
  ATENCION_PRIORITARIA: Crown,
};

const typeColors: Record<string, string> = {
  DESCUENTO_PORCENTUAL: 'bg-green-500',
  ENVIO_GRATIS: 'bg-cyan-500',
  MULTIPLICADOR_PUNTOS: 'bg-purple-500',
  PRODUCTO_BONIFICADO: 'bg-blue-500',
  ACCESO_ANTICIPADO: 'bg-violet-500',
  REGALO_CUMPLEANOS: 'bg-pink-500',
  ATENCION_PRIORITARIA: 'bg-red-500',
};

export default function Benefits() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const form = useForm<BenefitForm>({
    resolver: zodResolver(benefitSchema),
    defaultValues: {
      name: '',
      description: '',
      imageUrl: '',
      type: 'DESCUENTO_PORCENTUAL',
      value: 0,
      isActive: true,
      startDate: '',
      endDate: '',
      autoApply: false,
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ benefits: Benefit[]; pagination: any }>('/benefits?limit=100');
      setBenefits(res.data.benefits);
    } catch {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: BenefitForm) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        imageUrl: data.imageUrl || undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        type: data.type as 'DESCUENTO_PORCENTUAL' | 'ENVIO_GRATIS' | 'MULTIPLICADOR_PUNTOS' | 'PRODUCTO_BONIFICADO' | 'ACCESO_ANTICIPADO' | 'REGALO_CUMPLEANOS' | 'ATENCION_PRIORITARIA',
      };
      if (editingBenefit) {
        await api.put(`/benefits/${editingBenefit.id}`, payload);
      } else {
        await api.post('/benefits', payload);
      }
      setShowModal(false);
      setEditingBenefit(null);
      form.reset({ name: '', description: '', imageUrl: '', type: 'DESCUENTO_PORCENTUAL' as const, value: 0, isActive: true, startDate: '', endDate: '', autoApply: false });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este beneficio?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/benefits/${id}`);
      fetchData();
    } catch {
      // Error deleting
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (benefit: Benefit) => {
    setEditingBenefit(benefit);
    form.reset({
      name: benefit.name,
      description: benefit.description,
      imageUrl: benefit.imageUrl || '',
      type: benefit.type as 'DESCUENTO_PORCENTUAL' | 'ENVIO_GRATIS' | 'MULTIPLICADOR_PUNTOS' | 'PRODUCTO_BONIFICADO' | 'ACCESO_ANTICIPADO' | 'REGALO_CUMPLEANOS' | 'ATENCION_PRIORITARIA',
      value: benefit.value,
      isActive: benefit.isActive,
      startDate: benefit.startDate ? benefit.startDate.split('T')[0] : '',
      endDate: benefit.endDate ? benefit.endDate.split('T')[0] : '',
      autoApply: benefit.autoApply,
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingBenefit(null);
    form.reset({ name: '', description: '', imageUrl: '', type: 'DESCUENTO_PORCENTUAL' as const, value: 0, isActive: true, startDate: '', endDate: '', autoApply: false });
    setShowModal(true);
  };

  const filteredBenefits = benefits.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase());
    const matchesActive = filterActive === 'all' || (filterActive === 'active' && b.isActive) || (filterActive === 'inactive' && !b.isActive);
    return matchesSearch && matchesActive;
  });

  const isExpired = (endDate?: string) => endDate && new Date(endDate) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beneficios</h1>
          <p className="text-gray-500">Gestión de beneficios para clientes</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Beneficio
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar beneficios..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as any)} className="input w-36">
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
              </select>
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
            {filteredBenefits.map((benefit) => {
              const Icon = typeIcons[benefit.type] || Shield;
              const color = typeColors[benefit.type] || 'bg-gray-500';
              const expired = isExpired(benefit.endDate);
              const active = benefit.isActive && !expired;

              return (
                <div key={benefit.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', active ? color + '20' : 'bg-gray-100')}>
                      <Icon className={cn('w-5 h-5', active ? color.replace('500', '600') : 'text-gray-400')} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{benefit.name}</p>
                      <p className="text-sm text-gray-500">{typeLabels[benefit.type] || benefit.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('badge', active ? 'badge-success' : expired ? 'badge-danger' : 'badge-gray')}>
                      {active ? 'Activo' : expired ? 'Vencido' : 'Inactivo'}
                    </span>
                    {benefit.type === 'DESCUENTO_PORCENTUAL' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        -{benefit.value}%
                      </span>
                    )}
                    {benefit.type === 'MULTIPLICADOR_PUNTOS' && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        x{benefit.value}
                      </span>
                    )}
                    {benefit.type === 'ENVIO_GRATIS' && (
                      <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium">
                        Envío Gratis
                      </span>
                    )}
                    {benefit.autoApply && (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                        <CheckCircle className="w-3 h-3 inline mr-1" /> Automático
                      </span>
                    )}
                    {benefit.startDate && (
                      <span className="text-xs text-gray-500">
                        {new Date(benefit.startDate).toLocaleDateString('es-AR')}
                        {benefit.endDate && ` - ${new Date(benefit.endDate).toLocaleDateString('es-AR')}`}
                      </span>
                    )}
                    <button onClick={() => openEdit(benefit)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4" /></button>
                    <button
                      onClick={() => handleDelete(benefit.id)}
                      disabled={deletingId === benefit.id}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      {deletingId === benefit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredBenefits.length === 0 && !loading && (
          <div className="p-12 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron beneficios</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingBenefit ? 'Editar Beneficio' : 'Nuevo Beneficio'}</h2>
              <button onClick={() => { setShowModal(false); setEditingBenefit(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input {...form.register('name')} className="input" />
                {form.formState.errors.name && <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea {...form.register('description')} rows={3} className="input" />
                {form.formState.errors.description && <p className="text-sm text-red-600 mt-1">{form.formState.errors.description.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select {...form.register('type')} className="input">
                    <option value="DESCUENTO_PORCENTUAL">Descuento %</option>
                    <option value="ENVIO_GRATIS">Envío Gratis</option>
                    <option value="MULTIPLICADOR_PUNTOS">Multiplicador Puntos</option>
                    <option value="PRODUCTO_BONIFICADO">Producto Bonificado</option>
                    <option value="ACCESO_ANTICIPADO">Acceso Anticipado</option>
                    <option value="REGALO_CUMPLEANOS">Regalo Cumpleaños</option>
                    <option value="ATENCION_PRIORITARIA">Atención Prioritaria</option>
                  </select>
                </div>
                <div>
                  <label className="label">Imagen (opcional)</label>
                  <input {...form.register('imageUrl')} type="url" className="input" placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="label">Valor</label>
                <input type="number" min="0.1" step="0.1" {...form.register('value', { valueAsNumber: true })} className="input" />
                {form.formState.errors.value && <p className="text-sm text-red-600 mt-1">{form.formState.errors.value.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha Inicio (opcional)</label>
                  <input type="date" {...form.register('startDate')} className="input" />
                </div>
                <div>
                  <label className="label">Fecha Fin (opcional)</label>
                  <input type="date" {...form.register('endDate')} className="input" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...form.register('isActive')} className="rounded" id="benefitIsActive" />
                <label htmlFor="benefitIsActive" className="text-sm text-gray-700">Activo</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...form.register('autoApply')} className="rounded" id="benefitAutoApply" />
                <label htmlFor="benefitAutoApply" className="text-sm text-gray-700">Aplicar Automáticamente</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingBenefit(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}