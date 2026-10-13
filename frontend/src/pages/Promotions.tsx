import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { Plus, Search, Edit, Trash2, Loader2, Megaphone, Zap, Award, Gift, Sparkles, Ticket, ToggleLeft, ToggleRight } from 'lucide-react';

const promotionTypeSchema = z.enum(['DOBLE_PUNTOS', 'TRIPLE_PUNTOS', 'PUNTOS_EXTRA', 'DESCUENTO_PORCENTUAL', 'PRODUCTO_BONIFICADO', 'ENVIO_GRATIS']);

const promotionSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  type: promotionTypeSchema,
  multiplier: z.number().positive().optional(),
  bonusPoints: z.number().int().nonnegative().optional(),
  discount: z.number().positive().optional(),
  startDate: z.string().min(1, 'Fecha inicio requerida'),
  endDate: z.string().min(1, 'Fecha fin requerida'),
  isActive: z.boolean().default(true),
  categories: z.array(z.string()).default([]),
  brands: z.array(z.string()).default([]),
  products: z.array(z.string()).default([]),
  conditions: z.record(z.unknown()).optional(),
});

type PromotionForm = z.infer<typeof promotionSchema>;

interface Promotion {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type: string;
  multiplier: number;
  bonusPoints: number;
  discount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  categories: string[];
  brands: string[];
  products: string[];
  conditions?: Record<string, unknown>;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  DOBLE_PUNTOS: 'Doble Puntos',
  TRIPLE_PUNTOS: 'Triple Puntos',
  PUNTOS_EXTRA: 'Puntos Extra',
  DESCUENTO_PORCENTUAL: 'Descuento %',
  PRODUCTO_BONIFICADO: 'Producto Bonificado',
  ENVIO_GRATIS: 'Envío Gratis',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  DOBLE_PUNTOS: Zap,
  TRIPLE_PUNTOS: Zap,
  PUNTOS_EXTRA: Award,
  DESCUENTO_PORCENTUAL: Sparkles,
  PRODUCTO_BONIFICADO: Gift,
  ENVIO_GRATIS: Ticket,
};

const typeColors: Record<string, string> = {
  DOBLE_PUNTOS: 'bg-purple-500',
  TRIPLE_PUNTOS: 'bg-purple-600',
  PUNTOS_EXTRA: 'bg-amber-500',
  DESCUENTO_PORCENTUAL: 'bg-green-500',
  PRODUCTO_BONIFICADO: 'bg-blue-500',
  ENVIO_GRATIS: 'bg-cyan-500',
};

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const form = useForm<PromotionForm>({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      name: '',
      description: '',
      imageUrl: '',
      type: 'DOBLE_PUNTOS',
      multiplier: 1,
      bonusPoints: 0,
      discount: undefined,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      categories: [],
      brands: [],
      products: [],
      conditions: {},
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [promoRes, catRes, brandRes] = await Promise.all([
        api.get<{ promotions: Promotion[]; pagination: any }>('/promotions?limit=100'),
        api.get<{ name: string }[]>('/products/categories'),
        api.get<{ brands: Array<{ name: string }> }>('/brands?isActive=true&limit=100'),
      ]);
      setPromotions(promoRes.data.promotions);
      setCategories(catRes.data.map(c => c.name));
      setBrands(brandRes.data.brands.map(b => b.name));
    } catch {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: PromotionForm) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        imageUrl: data.imageUrl || undefined,
        discount: data.discount || undefined,
        multiplier: data.multiplier ?? 1,
        bonusPoints: data.bonusPoints ?? 0,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        conditions: data.conditions || undefined,
        type: data.type as 'DOBLE_PUNTOS' | 'TRIPLE_PUNTOS' | 'PUNTOS_EXTRA' | 'DESCUENTO_PORCENTUAL' | 'PRODUCTO_BONIFICADO' | 'ENVIO_GRATIS',
      };
      if (editingPromo) {
        await api.put(`/promotions/${editingPromo.id}`, payload);
      } else {
        await api.post('/promotions', payload);
      }
      setShowModal(false);
      setEditingPromo(null);
      form.reset({ name: '', description: '', imageUrl: '', type: 'DOBLE_PUNTOS' as const, multiplier: 1, bonusPoints: 0, startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], isActive: true, categories: [], brands: [], products: [] });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta promoción?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/promotions/${id}`);
      fetchData();
    } catch {
      // Error deleting
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      if (promo.isActive) {
        await api.post(`/promotions/${promo.id}/deactivate`);
      } else {
        await api.post(`/promotions/${promo.id}/activate`);
      }
      fetchData();
    } catch {
      // Error toggling
    }
  };

  const openEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    form.reset({
      name: promo.name,
      description: promo.description || '',
      imageUrl: promo.imageUrl || '',
      type: promo.type as 'DOBLE_PUNTOS' | 'TRIPLE_PUNTOS' | 'PUNTOS_EXTRA' | 'DESCUENTO_PORCENTUAL' | 'PRODUCTO_BONIFICADO' | 'ENVIO_GRATIS',
      multiplier: promo.multiplier,
      bonusPoints: promo.bonusPoints,
      discount: promo.discount,
      startDate: promo.startDate.split('T')[0],
      endDate: promo.endDate.split('T')[0],
      isActive: promo.isActive,
      categories: promo.categories,
      brands: promo.brands,
      products: promo.products,
      conditions: promo.conditions || {},
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingPromo(null);
    form.reset({
      name: '',
      description: '',
      imageUrl: '',
      type: 'DOBLE_PUNTOS' as const,
      multiplier: 1,
      bonusPoints: 0,
      discount: undefined,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      categories: [],
      brands: [],
      products: [],
      conditions: {},
    });
    setShowModal(true);
  };

  const filteredPromotions = promotions.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesActive = filterActive === 'all' || (filterActive === 'active' && p.isActive) || (filterActive === 'inactive' && !p.isActive);
    return matchesSearch && matchesActive;
  });

  const isExpired = (endDate: string) => new Date(endDate) < new Date();

  const renderConfigEditor = () => {
    const type = form.watch('type');
    return (
      <div className="border-t pt-4">
        <label className="label">Configuración</label>
        <div className="space-y-3">
          {type === 'DOBLE_PUNTOS' || type === 'TRIPLE_PUNTOS' ? (
            <div>
              <label className="label">Multiplicador</label>
              <input type="number" min="1.01" step="0.01" {...form.register('multiplier', { valueAsNumber: true })} className="input" defaultValue={type === 'DOBLE_PUNTOS' ? 2 : 3} />
            </div>
          ) : type === 'PUNTOS_EXTRA' ? (
            <div>
              <label className="label">Puntos Extra</label>
              <input type="number" min="1" {...form.register('bonusPoints', { valueAsNumber: true })} className="input" defaultValue={100} />
            </div>
          ) : type === 'DESCUENTO_PORCENTUAL' ? (
            <div>
              <label className="label">Descuento (%)</label>
              <input type="number" min="1" max="100" step="0.1" {...form.register('discount', { valueAsNumber: true })} className="input" defaultValue={10} />
            </div>
          ) : type === 'PRODUCTO_BONIFICADO' ? (
            <div>
              <label className="label">Puntos Bonus</label>
              <input type="number" min="1" {...form.register('bonusPoints', { valueAsNumber: true })} className="input" defaultValue={50} />
            </div>
          ) : type === 'ENVIO_GRATIS' ? (
            <p className="text-sm text-gray-500">No requiere configuración adicional</p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promociones</h1>
          <p className="text-gray-500">Gestión de promociones y ofertas especiales</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Promoción
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar promociones..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as any)}
              className="input w-40"
            >
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
            {filteredPromotions.map((promo) => {
              const Icon = typeIcons[promo.type] || Megaphone;
              const color = typeColors[promo.type] || 'bg-gray-500';
              const expired = isExpired(promo.endDate);
              const now = new Date();
              const active = promo.isActive && !expired && new Date(promo.startDate) <= now;

              return (
                <div key={promo.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', active ? color + '20' : 'bg-gray-100')}>
                      <Icon className={cn('w-5 h-5', active ? color.replace('500', '600') : 'text-gray-400')} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{promo.name}</p>
                      <p className="text-sm text-gray-500">{typeLabels[promo.type] || promo.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('badge', active ? 'badge-success' : expired ? 'badge-danger' : 'badge-gray')}>
                      {active ? 'Activa' : expired ? 'Vencida' : 'Inactiva'}
                    </span>
                    <span className="text-sm text-gray-500">{new Date(promo.startDate).toLocaleDateString('es-AR')} - {new Date(promo.endDate).toLocaleDateString('es-AR')}</span>
                    <button onClick={() => openEdit(promo)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4" /></button>
                    <button
                      onClick={() => handleToggleActive(promo)}
                      className={cn('p-2 rounded-lg transition-colors', active ? 'text-green-600 hover:bg-green-100' : 'text-gray-500 hover:bg-gray-100')}
                      title={active ? 'Desactivar' : 'Activar'}
                    >
                      {active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id)}
                      disabled={deletingId === promo.id}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      {deletingId === promo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredPromotions.length === 0 && !loading && (
          <div className="p-12 text-center text-gray-500">
            <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron promociones</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}</h2>
              <button onClick={() => { setShowModal(false); setEditingPromo(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select {...form.register('type')} className="input">
                    <option value="DOBLE_PUNTOS">Doble Puntos</option>
                    <option value="TRIPLE_PUNTOS">Triple Puntos</option>
                    <option value="PUNTOS_EXTRA">Puntos Extra</option>
                    <option value="DESCUENTO_PORCENTUAL">Descuento %</option>
                    <option value="PRODUCTO_BONIFICADO">Producto Bonificado</option>
                    <option value="ENVIO_GRATIS">Envío Gratis</option>
                  </select>
                  {form.formState.errors.type && <p className="text-sm text-red-600 mt-1">{form.formState.errors.type.message}</p>}
                </div>
                <div>
                  <label className="label">Imagen (opcional)</label>
                  <input {...form.register('imageUrl')} type="url" className="input" placeholder="https://..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha Inicio</label>
                  <input type="date" {...form.register('startDate')} className="input" />
                  {form.formState.errors.startDate && <p className="text-sm text-red-600 mt-1">{form.formState.errors.startDate.message}</p>}
                </div>
                <div>
                  <label className="label">Fecha Fin</label>
                  <input type="date" {...form.register('endDate')} className="input" />
                  {form.formState.errors.endDate && <p className="text-sm text-red-600 mt-1">{form.formState.errors.endDate.message}</p>}
                </div>
              </div>
              <div>
                <label className="label">Categorías</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <label key={cat} className="flex items-center gap-1 p-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" {...form.register('categories')} value={cat} className="rounded" />
                      <span className="text-sm">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Marcas</label>
                <div className="flex flex-wrap gap-2">
                  {brands.map(brand => (
                    <label key={brand} className="flex items-center gap-1 p-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" {...form.register('brands')} value={brand} className="rounded" />
                      <span className="text-sm">{brand}</span>
                    </label>
                  ))}
                </div>
              </div>
              {renderConfigEditor()}
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input type="checkbox" {...form.register('isActive')} className="rounded" />
                  <span>Activa</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingPromo(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}