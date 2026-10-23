import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { useToast } from '../components/Toast';
import { Plus, Search, Edit, Trash2, Loader2, Ticket, Copy } from 'lucide-react';

const couponTypeSchema = z.enum(['DESCUENTO_PORCENTUAL', 'PUNTOS_BONUS', 'PRODUCTO_GRATIS', 'ENVIO_GRATIS']);

const couponSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  type: couponTypeSchema,
  value: z.number().positive('Valor requerido'),
  maxUses: z.number().int().positive().optional(),
  startDate: z.string().min(1, 'Fecha inicio requerida'),
  endDate: z.string().min(1, 'Fecha fin requerida'),
  isActive: z.boolean().default(true),
  clientId: z.string().optional(),
  promotionId: z.string().optional(),
});

type CouponForm = z.infer<typeof couponSchema>;

const bulkCouponSchema = z.object({
  prefix: z.string().min(1, 'Prefijo requerido'),
  count: z.number().int().positive().max(1000, 'Máximo 1000 cupones'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  type: couponTypeSchema,
  value: z.number().positive('Valor requerido'),
  maxUses: z.number().int().positive().optional(),
  startDate: z.string().min(1, 'Fecha inicio requerida'),
  endDate: z.string().min(1, 'Fecha fin requerida'),
  isActive: z.boolean().default(true),
});

type BulkCouponForm = z.infer<typeof bulkCouponSchema>;

interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  value: number;
  maxUses?: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  clientId?: string;
  promotionId?: string;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  DESCUENTO_PORCENTUAL: 'Descuento %',
  PUNTOS_BONUS: 'Puntos Bonus',
  PRODUCTO_GRATIS: 'Producto Gratis',
  ENVIO_GRATIS: 'Envío Gratis',
};

const typeColors: Record<string, string> = {
  DESCUENTO_PORCENTUAL: 'bg-green-500',
  PUNTOS_BONUS: 'bg-amber-500',
  PRODUCTO_GRATIS: 'bg-blue-500',
  ENVIO_GRATIS: 'bg-cyan-500',
};

export default function Coupons() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterType, setFilterType] = useState<string>('');

  const form = useForm<CouponForm>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      type: 'DESCUENTO_PORCENTUAL',
      value: 0,
      maxUses: undefined,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      clientId: '',
      promotionId: '',
    },
  });

  const bulkForm = useForm<BulkCouponForm>({
    resolver: zodResolver(bulkCouponSchema),
    defaultValues: {
      prefix: '',
      count: 10,
      name: '',
      description: '',
      type: 'DESCUENTO_PORCENTUAL',
      value: 0,
      maxUses: undefined,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ coupons: Coupon[]; pagination: any }>('/coupons?limit=200');
      setCoupons(res.data.coupons);
    } catch {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: CouponForm) => {
    setSaving(true);
    try {
      const payload = { 
        ...data, 
        maxUses: data.maxUses || undefined, 
        clientId: data.clientId || undefined, 
        promotionId: data.promotionId || undefined,
        type: data.type as 'DESCUENTO_PORCENTUAL' | 'PUNTOS_BONUS' | 'PRODUCTO_GRATIS' | 'ENVIO_GRATIS',
      };
      if (editingCoupon) {
        await api.put(`/coupons/${editingCoupon.id}`, payload);
      } else {
        await api.post('/coupons', payload);
      }
      setShowModal(false);
      setEditingCoupon(null);
      form.reset({ code: '', name: '', description: '', type: 'DESCUENTO_PORCENTUAL' as const, value: 0, maxUses: undefined, startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], isActive: true });
      fetchData();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSubmit = async (data: BulkCouponForm) => {
    setSaving(true);
    try {
      const payload = { ...data, maxUses: data.maxUses || undefined };
      await api.post('/coupons/bulk', payload);
      setShowBulkModal(false);
      bulkForm.reset({ prefix: '', count: 10, name: '', description: '', type: 'DESCUENTO_PORCENTUAL', value: 0, maxUses: undefined, startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], isActive: true });
      fetchData();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Error al crear cupones');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cupón?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/coupons/${id}`);
      fetchData();
    } catch {
      // Error deleting
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    form.reset({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || '',
      type: coupon.type as 'DESCUENTO_PORCENTUAL' | 'PUNTOS_BONUS' | 'PRODUCTO_GRATIS' | 'ENVIO_GRATIS',
      value: coupon.value,
      maxUses: coupon.maxUses,
      startDate: coupon.startDate.split('T')[0],
      endDate: coupon.endDate.split('T')[0],
      isActive: coupon.isActive,
      clientId: coupon.clientId || '',
      promotionId: coupon.promotionId || '',
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingCoupon(null);
    form.reset({ code: '', name: '', description: '', type: 'DESCUENTO_PORCENTUAL' as const, value: 0, maxUses: undefined, startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], isActive: true });
    setShowModal(true);
  };

  const openBulkCreate = () => {
    bulkForm.reset({ prefix: '', count: 10, name: '', description: '', type: 'DESCUENTO_PORCENTUAL' as const, value: 0, maxUses: undefined, startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], isActive: true });
    setShowBulkModal(true);
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('success', 'Código copiado al portapapeles');
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast('success', 'Código copiado al portapapeles');
    }
  };

  const filteredCoupons = coupons.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    const matchesActive = filterActive === 'all' || (filterActive === 'active' && c.isActive) || (filterActive === 'inactive' && !c.isActive);
    const matchesType = !filterType || c.type === filterType;
    return matchesSearch && matchesActive && matchesType;
  });

  const isExpired = (endDate: string) => new Date(endDate) < new Date();
  const isFullyUsed = (coupon: Coupon) => coupon.maxUses !== undefined && coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cupones</h1>
          <p className="text-gray-500">Gestión de cupones y códigos promocionales</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openBulkCreate} className="btn-secondary">
            <Plus className="w-4 h-4 mr-2" />
            Crear en Lote
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cupón
          </button>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cupones..."
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
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input w-44">
                <option value="">Todos los tipos</option>
                <option value="DESCUENTO_PORCENTUAL">Descuento %</option>
                <option value="PUNTOS_BONUS">Puntos Bonus</option>
                <option value="PRODUCTO_GRATIS">Producto Gratis</option>
                <option value="ENVIO_GRATIS">Envío Gratis</option>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-sm text-gray-500">
                  <th className="p-4 font-medium">Código</th>
                  <th className="p-4 font-medium">Nombre</th>
                  <th className="p-4 font-medium">Tipo</th>
                  <th className="p-4 font-medium">Valor</th>
                  <th className="p-4 font-medium">Usos</th>
                  <th className="p-4 font-medium">Vigencia</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCoupons.map((coupon) => {
                  const expired = isExpired(coupon.endDate);
                  const fullyUsed = isFullyUsed(coupon);
                  const active = coupon.isActive && !expired && !fullyUsed;

                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50">
                      <td className="p-4 font-mono text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{coupon.code}</span>
                          <button onClick={() => copyToClipboard(coupon.code)} className="p-1 text-gray-400 hover:text-gray-600" title="Copiar">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-4 font-medium text-gray-900">{coupon.name}</td>
                      <td className="p-4">
                        <span className={cn('badge', typeColors[coupon.type])}>
                          {typeLabels[coupon.type] || coupon.type}
                        </span>
                      </td>
                      <td className="p-4 text-gray-900">
                        {coupon.type === 'DESCUENTO_PORCENTUAL' ? `-${coupon.value}%` :
                         coupon.type === 'PUNTOS_BONUS' ? `+${coupon.value} pts` :
                         coupon.type === 'PRODUCTO_GRATIS' ? 'Producto Gratis' : 'Envío Gratis'}
                      </td>
                      <td className="p-4 text-gray-600">
                        {coupon.maxUses ? `${coupon.usedCount} / ${coupon.maxUses}` : `${coupon.usedCount} / ∞`}
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {new Date(coupon.startDate).toLocaleDateString('es-AR')} - {new Date(coupon.endDate).toLocaleDateString('es-AR')}
                      </td>
                      <td className="p-4">
                        <span className={cn('badge', active ? 'badge-success' : expired ? 'badge-danger' : fullyUsed ? 'badge-warning' : 'badge-gray')}>
                          {active ? 'Activo' : expired ? 'Vencido' : fullyUsed ? 'Agotado' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(coupon)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Editar"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(coupon.id)} disabled={deletingId === coupon.id} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" aria-label="Eliminar">
                            {deletingId === coupon.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredCoupons.length === 0 && !loading && (
          <div className="p-12 text-center text-gray-500">
            <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron cupones</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingCoupon ? 'Editar Cupón' : 'Nuevo Cupón'}</h2>
              <button onClick={() => { setShowModal(false); setEditingCoupon(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              <div>
                <label className="label">Código (opcional, se genera automático)</label>
                <input {...form.register('code')} className="input" disabled={!!editingCoupon} placeholder="Auto-generado" />
                {form.formState.errors.code && <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>}
              </div>
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
                    <option value="DESCUENTO_PORCENTUAL">Descuento %</option>
                    <option value="PUNTOS_BONUS">Puntos Bonus</option>
                    <option value="PRODUCTO_GRATIS">Producto Gratis</option>
                    <option value="ENVIO_GRATIS">Envío Gratis</option>
                  </select>
                </div>
                <div>
                  <label className="label">Valor</label>
                  <input type="number" min="0.1" step="0.1" {...form.register('value', { valueAsNumber: true })} className="input" />
                  {form.formState.errors.value && <p className="text-sm text-red-600 mt-1">{form.formState.errors.value.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Máx. Usos (opcional)</label>
                  <input type="number" min="1" {...form.register('maxUses', { valueAsNumber: true })} className="input" placeholder="Ilimitado" />
                </div>
                <div>
                  <label className="label">Cliente Específico (opcional)</label>
                  <input type="text" {...form.register('clientId')} className="input" placeholder="ID del cliente" />
                </div>
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
                <input type="checkbox" {...form.register('isActive')} className="rounded" id="isActive" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Activo</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingCoupon(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Crear Cupones en Lote</h2>
              <button onClick={() => { setShowBulkModal(false); bulkForm.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={bulkForm.handleSubmit(handleBulkSubmit)} className="p-4 space-y-4">
              <div>
                <label className="label">Prefijo</label>
                <input {...bulkForm.register('prefix')} className="input" placeholder="DESC" />
                <p className="text-xs text-gray-500 mt-1">Ej: PROMO generará PROMO-A1B2, PROMO-C3D4, etc.</p>
              </div>
              <div>
                <label className="label">Cantidad</label>
                <input type="number" min="1" max="1000" {...bulkForm.register('count', { valueAsNumber: true })} className="input" />
                {bulkForm.formState.errors.count && <p className="text-sm text-red-600 mt-1">{bulkForm.formState.errors.count.message}</p>}
              </div>
              <div>
                <label className="label">Nombre Base</label>
                <input {...bulkForm.register('name')} className="input" placeholder="Promoción Verano" />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea {...bulkForm.register('description')} rows={2} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select {...bulkForm.register('type')} className="input">
                    <option value="DESCUENTO_PORCENTUAL">Descuento %</option>
                    <option value="PUNTOS_BONUS">Puntos Bonus</option>
                    <option value="PRODUCTO_GRATIS">Producto Gratis</option>
                    <option value="ENVIO_GRATIS">Envío Gratis</option>
                  </select>
                </div>
                <div>
                  <label className="label">Valor</label>
                  <input type="number" min="0.1" step="0.1" {...bulkForm.register('value', { valueAsNumber: true })} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Máx. Usos (opcional)</label>
                  <input type="number" min="1" {...bulkForm.register('maxUses', { valueAsNumber: true })} className="input" placeholder="Ilimitado" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha Inicio</label>
                  <input type="date" {...bulkForm.register('startDate')} className="input" />
                </div>
                <div>
                  <label className="label">Fecha Fin</label>
                  <input type="date" {...bulkForm.register('endDate')} className="input" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...bulkForm.register('isActive')} className="rounded" id="bulkIsActive" />
                <label htmlFor="bulkIsActive" className="text-sm text-gray-700">Activo</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowBulkModal(false); bulkForm.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Cupones'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}