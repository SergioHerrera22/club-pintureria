import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn, formatNumber } from '../lib/utils';
import { ArrowLeft, Ticket, Award, Gift, Search, Clock, Sparkles } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string;
  type: string;
  value: number;
  maxUses: number | null;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  promotion: {
    id: string;
    name: string;
    type: string;
    multiplier: number;
    bonusPoints: number;
    discount: number;
  } | null;
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

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  DESCUENTO_PORCENTUAL: Sparkles,
  PUNTOS_BONUS: Award,
  PRODUCTO_GRATIS: Gift,
  ENVIO_GRATIS: Ticket,
};

export default function ClientCoupons() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'used' | 'expiring'>('all');

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchCoupons();
  }, [isAuthenticated]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const response = await api.get('/client/coupons');
      setCoupons(response.data.coupons);
    } catch (err: any) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error al cargar cupones');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredCoupons = coupons.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.code.toLowerCase().includes(search.toLowerCase());
    
    let matchesStatus = true;
    const now = new Date();
    const endDate = new Date(c.endDate);
    const isExpired = endDate < now;
    const isUsed = c.usedCount > 0 && (c.maxUses === null || c.usedCount >= c.maxUses);
    
    if (filterStatus === 'available') {
      matchesStatus = c.isActive && !isExpired && !isUsed;
    } else if (filterStatus === 'used') {
      matchesStatus = isUsed;
    } else if (filterStatus === 'expiring') {
      const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      matchesStatus = c.isActive && !isExpired && !isUsed && daysLeft <= 7;
    }
    
    return matchesSearch && matchesStatus;
  });

  const availableCoupons = coupons.filter(c => c.isActive && new Date(c.endDate) >= new Date() && (c.usedCount === 0 || (c.maxUses !== null && c.usedCount < c.maxUses)));
  const expiringSoon = coupons.filter(c => {
    const daysLeft = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return c.isActive && new Date(c.endDate) >= new Date() && daysLeft <= 7 && daysLeft > 0;
  });
  const usedCoupons = coupons.filter(c => c.usedCount > 0 && (c.maxUses === null || c.usedCount >= c.maxUses));
  const expiredCoupons = coupons.filter(c => new Date(c.endDate) < new Date());

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <button onClick={() => navigate('/app/home')} className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Cupones</h1>
                  <p className="text-sm text-gray-500">Gestiona tus cupones y descuentos</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto p-6 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/app/home')} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                <Ticket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Mis Cupones</h1>
                <p className="text-sm text-gray-500">{availableCoupons.length} disponibles · {expiringSoon.length} por vencer</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="input w-44"
            >
              <option value="all">Todos</option>
              <option value="available">Disponibles</option>
              <option value="used">Utilizados</option>
              <option value="expiring">Por vencer</option>
            </select>
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[
            { label: 'Disponibles', count: availableCoupons.length, color: 'bg-green-500', active: filterStatus === 'available' },
            { label: 'Por vencer', count: expiringSoon.length, color: 'bg-amber-500', active: filterStatus === 'expiring' },
            { label: 'Utilizados', count: usedCoupons.length, color: 'bg-blue-500', active: filterStatus === 'used' },
            { label: 'Vencidos', count: expiredCoupons.length, color: 'bg-gray-500', active: filterStatus === 'all' },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() => setFilterStatus(stat.label === 'Disponibles' ? 'available' : stat.label === 'Por vencer' ? 'expiring' : stat.label === 'Utilizados' ? 'used' : 'all')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                stat.active
                  ? `${stat.color} text-white`
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
              )}
            >
              {stat.label} <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">{stat.count}</span>
            </button>
          ))}
        </div>

        {filteredCoupons.length === 0 ? (
          <div className="text-center py-12">
            <Ticket className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No se encontraron cupones</h2>
            <p className="text-gray-500">Intenta cambiar los filtros o busca con otros términos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCoupons.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface CouponCardProps {
  coupon: Coupon;
}

function CouponCard({ coupon }: CouponCardProps) {
  const now = new Date();
  const endDate = new Date(coupon.endDate);
  const isExpired = endDate < now;
  const isUsed = coupon.usedCount > 0 && (coupon.maxUses === null || coupon.usedCount >= coupon.maxUses);
  
  const Icon = typeIcons[coupon.type] || Sparkles;
  const color = typeColors[coupon.type] || 'bg-gray-500';

  return (
    <div className={cn('p-4 bg-white rounded-xl border border-gray-200 flex items-center justify-between', coupon.isActive === false && 'opacity-50')}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn('p-3 rounded-xl', color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn('font-semibold text-gray-900 truncate', coupon.isActive === false && 'text-gray-400')}>{coupon.name}</h3>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', coupon.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {coupon.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">Código: <span className="font-mono font-medium">{coupon.code}</span></p>
          <p className="text-xs text-gray-400 truncate">{coupon.description}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('px-3 py-1 rounded-full text-sm font-medium', color)}>
            <Icon className="w-3 h-3 inline mr-1" />
            {typeLabels[coupon.type] || coupon.type}
          </span>
          {coupon.type === 'DESCUENTO_PORCENTUAL' && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              -{coupon.value}%
            </span>
          )}
          {coupon.type === 'PUNTOS_BONUS' && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
              +{formatNumber(coupon.value)} pts
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {coupon.usedCount > 0 ? `${coupon.usedCount} uso${coupon.usedCount !== 1 ? 's' : ''}` : 'Sin usar'}
          </span>
          <span className={cn(
            'px-2 py-1 rounded-full font-medium',
            coupon.isActive && !isExpired && !isUsed ? 'bg-green-100 text-green-700' :
            isExpired ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          )}>
            {isExpired ? 'Vencido' : isUsed ? 'Usado' : `${Math.ceil((new Date(coupon.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} día${Math.ceil((new Date(coupon.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>
    </div>
  );
}