import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn, formatNumber } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';
import { Plus, Edit, Trash2, Loader2, Tag, Award, Search, RefreshCw, User, CheckCircle, ArrowRight } from 'lucide-react';

const prizeSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  pointsCost: z.number().int().positive('Costo en puntos requerido'),
  stock: z.number().int().nonnegative().default(0),
  category: z.string().min(1, 'Categoría requerida'),
  status: z.enum(['DISPONIBLE', 'AGOTADO', 'DESCONTINUADO']).default('DISPONIBLE'),
  isActive: z.boolean().default(true),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});

type PrizeForm = z.infer<typeof prizeSchema>;

interface Prize {
  id: string;
  code: string;
  name: string;
  description?: string;
  imageUrl?: string;
  pointsCost: number;
  stock: number;
  status: 'DISPONIBLE' | 'AGOTADO' | 'DESCONTINUADO';
  category: string;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
}

interface ClientInfo {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  currentPoints: number;
}

interface Redemption {
  id: string;
  userId: string;
  user: { firstName: string; lastName: string; dni: string };
  prizeId: string;
  prize: Prize;
  pointsSpent: number;
  status: string;
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
}

const categories = ['Descuentos', 'Productos', 'Herramientas', 'Experiencias', 'Otros'];

const statusColors: Record<string, string> = {
  DISPONIBLE: 'badge-success',
  AGOTADO: 'badge-danger',
  DESCOTINUADO: 'badge-gray',
};

const statusLabels: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  AGOTADO: 'Agotado',
  DESCOTINUADO: 'Descontinuado',
};

export default function Prizes() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [showRedemptions, setShowRedemptions] = useState(false);
  const [search, setSearch] = useState('');
  const [clientSearchDni, setClientSearchDni] = useState('');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState('');
  const [redeemLoading, setRedeemLoading] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<{ prizeName: string; pointsSpent: number; newBalance: number } | null>(null);
  
  const form = useForm<PrizeForm>({
    resolver: zodResolver(prizeSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      imageUrl: '',
      pointsCost: 0,
      stock: 0,
      category: 'Descuentos',
      status: 'DISPONIBLE',
      isActive: true,
      validFrom: '',
      validTo: '',
    },
  });
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ prizes: Prize[]; pagination: any }>('/prizes?limit=100');
      setPrizes(res.data.prizes);
    } catch {
      setError('Error al cargar premios');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchRedemptions = async () => {
    try {
      const res = await api.get<{ redemptions: Redemption[] }>('/prizes/redemptions/history?limit=50');
      setRedemptions(res.data.redemptions);
      setShowRedemptions(true);
    } catch {
      setError('Error al cargar canjes');
    }
  };
  
  const searchClient = async (dni: string) => {
    if (dni.length < 7) return;
    setClientLoading(true);
    setClientError('');
    setClientInfo(null);
    try {
      const res = await api.get<ClientInfo>(`/clients/dni/${dni}/points`);
      setClientInfo(res.data);
    } catch (err: any) {
      setClientError(err.response?.data?.error || 'Cliente no encontrado');
    } finally {
      setClientLoading(false);
    }
  };
  
  const handleRedeem = async (prize: Prize) => {
    if (!clientInfo) return;
    
    if (clientInfo.currentPoints < prize.pointsCost) {
      setClientError(`Puntos insuficientes. Le faltan ${formatNumber(prize.pointsCost - clientInfo.currentPoints)} puntos.`);
      return;
    }
    if (prize.stock <= 0) {
      setClientError('Premio sin stock disponible.');
      return;
    }
    
    setRedeemLoading(prize.id);
    setClientError('');
    
    try {
      const res = await api.post('/prizes/redeem/client', {
        dni: clientInfo.dni,
        prizeId: prize.id,
      });
      
      const newBalance = res.data.newBalance;
      const pointsSpent = res.data.prize.pointsCost;
      
      setRedeemSuccess({
        prizeName: res.data.prize.name,
        pointsSpent,
        newBalance,
      });
      
      setClientInfo({ ...clientInfo, currentPoints: newBalance });
      
      setPrizes(prev => prev.map(p => {
        if (p.id === prize.id) {
          return { ...p, stock: p.stock - 1 };
        }
        return p;
      }));
    } catch (err: any) {
      setClientError(err.response?.data?.error || 'Error al canjear premio');
    } finally {
      setRedeemLoading(null);
    }
  };
  
  const closeSuccessModal = () => {
    setRedeemSuccess(null);
  };
  
  const [error, setError] = useState('');
  
  useEffect(() => { fetchData(); }, []);
  
  const handleSubmit = async (data: PrizeForm) => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...data, imageUrl: data.imageUrl || undefined };
      if (editingPrize) {
        await api.put(`/prizes/${editingPrize.id}`, payload);
      } else {
        await api.post('/prizes', payload);
      }
      setShowModal(false);
      setEditingPrize(null);
      form.reset({ code: '', name: '', description: '', imageUrl: '', pointsCost: 0, stock: 0, category: 'Descuentos', status: 'DISPONIBLE', isActive: true });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este premio?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/prizes/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };
  
  const openEdit = (prize: Prize) => {
    setEditingPrize(prize);
    form.reset({
      code: prize.code,
      name: prize.name,
      description: prize.description || '',
      imageUrl: prize.imageUrl || '',
      pointsCost: prize.pointsCost,
      stock: prize.stock,
      category: prize.category,
      status: prize.status,
      isActive: prize.isActive,
      validFrom: prize.validFrom ? prize.validFrom.split('T')[0] : '',
      validTo: prize.validTo ? prize.validTo.split('T')[0] : '',
    });
    setShowModal(true);
  };
  
  const openCreate = () => {
    setEditingPrize(null);
    form.reset({ code: '', name: '', description: '', imageUrl: '', pointsCost: 0, stock: 0, category: 'Descuentos', status: 'DISPONIBLE', isActive: true, validFrom: '', validTo: '' });
    setShowModal(true);
  };
  
  const filteredPrizes = prizes.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );
  
  const getPrizeStatus = (prize: Prize, clientPoints: number) => {
    if (!prize.isActive || prize.status !== 'DISPONIBLE' || prize.stock <= 0) {
      return { canRedeem: false, reason: 'No disponible', color: 'text-gray-500' };
    }
    if (clientPoints >= prize.pointsCost) {
      return { canRedeem: true, reason: '¡Puede canjear!', color: 'text-green-600' };
    }
    return { 
      canRedeem: false, 
      reason: `Faltan ${formatNumber(prize.pointsCost - clientPoints)} pts`, 
      color: 'text-amber-600' 
    };
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Premios</h1>
          <p className="text-gray-500">Premios disponibles para canje por puntos</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={fetchRedemptions} className="btn-outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Historial Canjes
            </button>
          )}
          {isAdmin && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Premio
            </button>
          )}
        </div>
      </div>
      
      {/* Client Search Section for Cajera */}
      {!isAdmin && (
        <div className="card p-4 bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary-600 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Buscar Cliente para Canje</h3>
              <p className="text-sm text-gray-500">Ingrese DNI para ver puntos disponibles y canjear premios</p>
            </div>
          </div>
          <div className="flex gap-3 max-w-md">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="DNI del cliente (ej: 20123456)"
                value={clientSearchDni}
                onChange={(e) => setClientSearchDni(e.target.value)}
                className="input pl-10"
                maxLength={8}
                onKeyDown={(e) => e.key === 'Enter' && searchClient(e.currentTarget.value)}
              />
            </div>
            <button
              onClick={() => searchClient(clientSearchDni)}
              disabled={clientLoading || clientSearchDni.length < 7}
              className="btn-primary whitespace-nowrap"
            >
              {clientLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
            </button>
          </div>
          {clientError && <p className="mt-2 text-sm text-red-600">{clientError}</p>}
          
          {clientInfo && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-primary-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <Award className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{clientInfo.firstName} {clientInfo.lastName}</p>
                    <p className="text-sm text-gray-500">DNI: {clientInfo.dni}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Puntos disponibles</p>
                  <p className="text-2xl font-bold text-primary-600">{formatNumber(clientInfo.currentPoints)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {showRedemptions && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Historial de Canjes</h2>
            <button onClick={() => setShowRedemptions(false)} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-sm text-gray-500">
                  <th className="p-4 font-medium">Fecha</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Premio</th>
                  <th className="p-4 font-medium text-right">Puntos</th>
                  <th className="p-4 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {redemptions.map(r => (
                  <tr key={r.id}>
                    <td className="p-4 text-sm">{new Date(r.createdAt).toLocaleDateString('es-AR')}</td>
                    <td className="p-4">{r.user.firstName} {r.user.lastName} ({r.user.dni})</td>
                    <td className="p-4">{r.prize.name}</td>
                    <td className="p-4 text-right font-medium text-red-600">{formatNumber(r.pointsSpent)}</td>
                    <td className="p-4"><span className="badge badge-info">{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar premios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
        
        {loading ? (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse card p-4">
                <div className="h-32 bg-gray-200 rounded mb-3" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPrizes.map(prize => {
              const clientPoints = clientInfo?.currentPoints || 0;
              const prizeStatus = getPrizeStatus(prize, clientPoints);
              
              return (
                <div key={prize.id} className={cn(
                  'card p-4 flex flex-col',
                  !isAdmin && !prizeStatus.canRedeem && 'opacity-75 bg-gray-50'
                )}>
                  <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                    {prize.imageUrl ? (
                      <img src={prize.imageUrl} alt={prize.name} className="w-full h-full object-cover" />
                    ) : (
                      <Tag className="w-12 h-12 text-gray-400" />
                    )}
                    <span className="absolute top-2 right-2 bg-primary-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                      {formatNumber(prize.pointsCost)} pts
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn('badge', statusColors[prize.status])}>{statusLabels[prize.status]}</span>
                      <span className="text-sm text-gray-500">{prize.category}</span>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">{prize.name}</h3>
                    {prize.description && <p className="text-sm text-gray-500 line-clamp-2 mb-2">{prize.description}</p>}
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-500">Stock: {prize.stock}</span>
                      {clientInfo && (
                        <span className={cn('font-medium', prizeStatus.color)}>
                          {prizeStatus.reason}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                    {isAdmin && (
                      <>
                        <button onClick={() => openEdit(prize)} className="flex-1 btn-outline text-sm py-1.5"><Edit className="w-4 h-4 mr-1" /> Editar</button>
                        <button onClick={() => handleDelete(prize.id)} disabled={deletingId === prize.id} className="btn-danger text-sm py-1.5"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                    {!isAdmin && clientInfo && prizeStatus.canRedeem && (
                      <button
                        onClick={() => handleRedeem(prize)}
                        disabled={redeemLoading === prize.id}
                        className="flex-1 btn-primary py-1.5"
                      >
                        {redeemLoading === prize.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            Canjear <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    )}
                    {!isAdmin && clientInfo && !prizeStatus.canRedeem && (
                      <button className="flex-1 btn-secondary py-1.5" disabled>
                        {prizeStatus.reason === 'No disponible' ? 'No disponible' : prizeStatus.reason}
                      </button>
                    )}
                    {!isAdmin && !clientInfo && (
                      <button className="flex-1 btn-outline py-1.5" disabled>
                        Buscar cliente primero
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {filteredPrizes.length === 0 && !loading && (
          <div className="p-12 text-center text-gray-500">
            <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron premios</p>
          </div>
        )}
      </div>
      
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingPrize ? 'Editar Premio' : 'Nuevo Premio'}</h2>
              <button onClick={() => { setShowModal(false); setEditingPrize(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Código</label>
                  <input {...form.register('code')} className="input" disabled={!!editingPrize} />
                  {form.formState.errors.code && <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>}
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <select {...form.register('category')} className="input">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
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
              <div>
                <label className="label">URL Imagen (opcional)</label>
                <input {...form.register('imageUrl')} type="url" className="input" placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Costo en Puntos</label>
                  <input type="number" min="1" {...form.register('pointsCost', { valueAsNumber: true })} className="input" />
                  {form.formState.errors.pointsCost && <p className="text-sm text-red-600 mt-1">{form.formState.errors.pointsCost.message}</p>}
                </div>
                <div>
                  <label className="label">Stock</label>
                  <input type="number" min="0" {...form.register('stock', { valueAsNumber: true })} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Estado</label>
                  <select {...form.register('status')} className="input">
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="AGOTADO">Agotado</option>
                    <option value="DESCONTINUADO">Descontinuado</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...form.register('isActive')} className="rounded" />
                    <span>Activo</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Válido Desde</label>
                  <input type="date" {...form.register('validFrom')} className="input" />
                </div>
                <div>
                  <label className="label">Válido Hasta</label>
                  <input type="date" {...form.register('validTo')} className="input" />
                </div>
              </div>
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingPrize(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {redeemSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">¡Canje realizado!</h3>
            <p className="text-gray-600 mb-1">Has canjeado <strong>{redeemSuccess.prizeName}</strong></p>
            <p className="text-gray-500 mb-4">Se descontaron {formatNumber(redeemSuccess.pointsSpent)} puntos</p>
            <p className="text-sm text-gray-500 mb-6">Nuevo saldo: <strong className="text-primary-600">{formatNumber(redeemSuccess.newBalance)} pts</strong></p>
            <button onClick={closeSuccessModal} className="btn-primary w-full">Continuar</button>
          </div>
        </div>
      )}
    </div>
  );
}
