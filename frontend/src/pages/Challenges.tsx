import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { Plus, Search, Edit, Trash2, Loader2, Trophy, Target, Zap, Flag, Calendar, Layers } from 'lucide-react';

const challengeTypeSchema = z.enum(['CANTIDAD_PRODUCTOS', 'CANTIDAD_COMPRAS', 'MARCAS_DIFERENTES', 'CATEGORIAS_DIFERENTES', 'MONTO_ACUMULADO', 'FRECUENCIA_COMPRA']);

const challengeSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().min(1, 'Descripción requerida'),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  type: challengeTypeSchema,
  target: z.number().int().positive('Objetivo requerido'),
  condition: z.record(z.unknown()),
  rewardPoints: z.number().int().nonnegative('Puntos de recompensa requeridos'),
  rewardCoupon: z.string().optional(),
  startDate: z.string().min(1, 'Fecha inicio requerida'),
  endDate: z.string().min(1, 'Fecha fin requerida'),
  isActive: z.boolean().default(true),
});

type ChallengeForm = z.infer<typeof challengeSchema>;

interface Challenge {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  type: string;
  target: number;
  condition: Record<string, unknown>;
  rewardPoints: number;
  rewardCoupon?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  CANTIDAD_PRODUCTOS: 'Cantidad de Productos',
  CANTIDAD_COMPRAS: 'Cantidad de Compras',
  MARCAS_DIFERENTES: 'Marcas Diferentes',
  CATEGORIAS_DIFERENTES: 'Categorías Diferentes',
  MONTO_ACUMULADO: 'Monto Acumulado',
  FRECUENCIA_COMPRA: 'Frecuencia de Compra',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  CANTIDAD_PRODUCTOS: Zap,
  CANTIDAD_COMPRAS: Trophy,
  MARCAS_DIFERENTES: Flag,
  CATEGORIAS_DIFERENTES: Layers,
  MONTO_ACUMULADO: Target,
  FRECUENCIA_COMPRA: Calendar,
};

const defaultConditions: Record<string, Record<string, unknown>> = {
  CANTIDAD_PRODUCTOS: {},
  CANTIDAD_COMPRAS: {},
  MARCAS_DIFERENTES: {},
  CATEGORIAS_DIFERENTES: {},
  MONTO_ACUMULADO: {},
  FRECUENCIA_COMPRA: {},
};

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const form = useForm<ChallengeForm>({
    resolver: zodResolver(challengeSchema),
    defaultValues: {
      name: '',
      description: '',
      imageUrl: '',
      type: 'CANTIDAD_PRODUCTOS',
      target: 1,
      condition: {},
      rewardPoints: 0,
      rewardCoupon: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ challenges: Challenge[]; pagination: any }>('/challenges?limit=100');
      setChallenges(res.data.challenges);
    } catch {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: ChallengeForm) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        imageUrl: data.imageUrl || undefined,
        condition: data.condition || {},
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        type: data.type as 'CANTIDAD_PRODUCTOS' | 'CANTIDAD_COMPRAS' | 'MARCAS_DIFERENTES' | 'CATEGORIAS_DIFERENTES' | 'MONTO_ACUMULADO' | 'FRECUENCIA_COMPRA',
      };
      if (editingChallenge) {
        await api.put(`/challenges/${editingChallenge.id}`, payload);
      } else {
        await api.post('/challenges', payload);
      }
      setShowModal(false);
      setEditingChallenge(null);
      form.reset({ name: '', description: '', imageUrl: '', type: 'CANTIDAD_PRODUCTOS' as const, target: 1, condition: {}, rewardPoints: 0, rewardCoupon: '', startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], isActive: true });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este desafío?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/challenges/${id}`);
      fetchData();
    } catch {
      // Error deleting
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    form.reset({
      name: challenge.name,
      description: challenge.description,
      imageUrl: challenge.imageUrl || '',
      type: challenge.type as 'CANTIDAD_PRODUCTOS' | 'CANTIDAD_COMPRAS' | 'MARCAS_DIFERENTES' | 'CATEGORIAS_DIFERENTES' | 'MONTO_ACUMULADO' | 'FRECUENCIA_COMPRA',
      target: challenge.target,
      condition: challenge.condition || {},
      rewardPoints: challenge.rewardPoints,
      rewardCoupon: challenge.rewardCoupon || '',
      startDate: challenge.startDate.split('T')[0],
      endDate: challenge.endDate.split('T')[0],
      isActive: challenge.isActive,
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingChallenge(null);
    form.reset({ name: '', description: '', imageUrl: '', type: 'CANTIDAD_PRODUCTOS' as const, target: 1, condition: {}, rewardPoints: 0, rewardCoupon: '', startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], isActive: true });
    setShowModal(true);
  };

  const filteredChallenges = challenges.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase());
    const matchesActive = filterActive === 'all' || (filterActive === 'active' && c.isActive) || (filterActive === 'inactive' && !c.isActive);
    return matchesSearch && matchesActive;
  });

  const isExpired = (endDate: string) => new Date(endDate) < new Date();

  const renderConditionEditor = () => {
    const type = form.watch('type');
    
    switch (type) {
      case 'MARCAS_DIFERENTES':
      case 'CATEGORIAS_DIFERENTES':
        return (
          <div>
            <label className="label">Condición (opcional)</label>
            <p className="text-sm text-gray-500 mb-2">El sistema contará automáticamente las marcas/categorías diferentes en cada compra.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Mínimo por compra</label>
                <input type="number" min="1" {...form.register('condition.minPerPurchase', { valueAsNumber: true })} className="input" placeholder="1" />
              </div>
            </div>
          </div>
        );
      case 'MONTO_ACUMULADO':
        return (
          <div>
            <label className="label">Monto mínimo por compra para contar</label>
            <input type="number" min="0" step="0.01" {...form.register('condition.minAmount', { valueAsNumber: true })} className="input" placeholder="0" />
          </div>
        );
      case 'FRECUENCIA_COMPRA':
        return (
          <div>
            <label className="label">Días máximos entre compras</label>
            <input type="number" min="1" {...form.register('condition.maxDaysBetween', { valueAsNumber: true })} className="input" placeholder="30" />
          </div>
        );
      default:
        return (
          <p className="text-sm text-gray-500">Sin configuración adicional para este tipo</p>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Desafíos</h1>
          <p className="text-gray-500">Gestión de desafíos y misiones para clientes</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Desafío
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar desafíos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as any)} className="input w-40">
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
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
            {filteredChallenges.map((challenge) => {
              const Icon = typeIcons[challenge.type] || Trophy;
              const expired = isExpired(challenge.endDate);
              const now = new Date();
              const active = challenge.isActive && !expired && new Date(challenge.startDate) <= now;

              return (
                <div key={challenge.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', active ? 'bg-amber-100' : 'bg-gray-100')}>
                      <Icon className={cn('w-5 h-5', active ? 'text-amber-600' : 'text-gray-400')} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{challenge.name}</p>
                      <p className="text-sm text-gray-500">{typeLabels[challenge.type] || challenge.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('badge', active ? 'badge-success' : expired ? 'badge-danger' : 'badge-gray')}>
                      {active ? 'Activo' : expired ? 'Vencido' : 'Inactivo'}
                    </span>
                    <span className="text-sm text-gray-500">Meta: {challenge.target} {challenge.type === 'MONTO_ACUMULADO' ? '$' : ''}</span>
                    <span className="text-sm text-gray-500">{new Date(challenge.startDate).toLocaleDateString('es-AR')} - {new Date(challenge.endDate).toLocaleDateString('es-AR')}</span>
                    <button onClick={() => openEdit(challenge)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4" /></button>
                    <button
                      onClick={() => handleDelete(challenge.id)}
                      disabled={deletingId === challenge.id}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      {deletingId === challenge.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredChallenges.length === 0 && !loading && (
          <div className="p-12 text-center text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron desafíos</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingChallenge ? 'Editar Desafío' : 'Nuevo Desafío'}</h2>
              <button onClick={() => { setShowModal(false); setEditingChallenge(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
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
                  <select {...form.register('type')} className="input" onChange={(e) => form.setValue('condition', defaultConditions[e.target.value] || {})}>
                    <option value="CANTIDAD_PRODUCTOS">Cantidad de Productos</option>
                    <option value="CANTIDAD_COMPRAS">Cantidad de Compras</option>
                    <option value="MARCAS_DIFERENTES">Marcas Diferentes</option>
                    <option value="CATEGORIAS_DIFERENTES">Categorías Diferentes</option>
                    <option value="MONTO_ACUMULADO">Monto Acumulado</option>
                    <option value="FRECUENCIA_COMPRA">Frecuencia de Compra</option>
                  </select>
                </div>
                <div>
                  <label className="label">Imagen (opcional)</label>
                  <input {...form.register('imageUrl')} type="url" className="input" placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="label">Objetivo</label>
                <input type="number" min="1" {...form.register('target', { valueAsNumber: true })} className="input" />
                {form.formState.errors.target && <p className="text-sm text-red-600 mt-1">{form.formState.errors.target.message}</p>}
              </div>
              {renderConditionEditor()}
              <div>
                <label className="label">Cupón de Recompensa (opcional)</label>
                <input {...form.register('rewardCoupon')} className="input" placeholder="Código de cupón a regalar al completar" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha Inicio</label>
                  <input type="date" {...form.register('startDate')} className="input" />
                </div>
                <div>
                  <label className="label">Fecha Fin</label>
                  <input type="date" {...form.register('endDate')} className="input" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...form.register('isActive')} className="rounded" id="challengeIsActive" />
                <label htmlFor="challengeIsActive" className="text-sm text-gray-700">Activo</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingChallenge(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}