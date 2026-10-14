import { useState, useEffect } from 'react';
import ClientHeader from '../components/ClientHeader';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { Sparkles, Zap, Award, Gift, Ticket, Search } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Promotion {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: string;
  multiplier: number;
  bonusPoints: number;
  discount: number;
  startDate: string;
  endDate: string;
  categories: string[];
  brands: string[];
  products: string[];
}

const typeLabels: Record<string, string> = {
  DOBLE_PUNTOS: 'Doble Puntos',
  TRIPLE_PUNTOS: 'Triple Puntos',
  PUNTOS_EXTRA: 'Puntos Extra',
  DESCUENTO_PORCENTUAL: 'Descuento %',
  PRODUCTO_BONIFICADO: 'Producto Bonificado',
  ENVIO_GRATIS: 'Envío Gratis',
};

const typeColors: Record<string, string> = {
  DOBLE_PUNTOS: 'bg-purple-500',
  TRIPLE_PUNTOS: 'bg-purple-600',
  PUNTOS_EXTRA: 'bg-amber-500',
  DESCUENTO_PORCENTUAL: 'bg-green-500',
  PRODUCTO_BONIFICADO: 'bg-blue-500',
  ENVIO_GRATIS: 'bg-cyan-500',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  DOBLE_PUNTOS: Zap,
  TRIPLE_PUNTOS: Zap,
  PUNTOS_EXTRA: Award,
  DESCUENTO_PORCENTUAL: Sparkles,
  PRODUCTO_BONIFICADO: Gift,
  ENVIO_GRATIS: Ticket,
};

export default function ClientPromotions() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchPromotions();
  }, [isAuthenticated]);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/client/promotions');
      setPromotions(response.data.promotions);
    } catch (err: any) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error al cargar promociones');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
<div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Promociones</h1>
                  <p className="text-sm text-gray-500">Ofertas y beneficios disponibles</p>
                </div>
              </div>
            </div>
            </div>
            </header>
          <main className="max-w-4xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse bg-white rounded-xl p-4 border border-gray-200">
                  <div className="h-32 bg-gray-200 rounded-lg mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
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

  const activePromotions = promotions.filter(p => new Date(p.endDate) >= new Date());
  const expiredPromotions = promotions.filter(p => new Date(p.endDate) < new Date());

  return (
    <div className="min-h-screen bg-gray-50">
            <ClientHeader title="Mis Promociones" subtitle={<>{activePromotions.length} activas · {expiredPromotions.length} vencidas</>} backTo="/app/home" maxWidth="4xl" />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input w-40"
            >
              <option value="">Todos los tipos</option>
              <option value="DOBLE_PUNTOS">Doble Puntos</option>
              <option value="TRIPLE_PUNTOS">Triple Puntos</option>
              <option value="PUNTOS_EXTRA">Puntos Extra</option>
              <option value="DESCUENTO_PORCENTUAL">Descuento %</option>
              <option value="PRODUCTO_BONIFICADO">Producto Bonificado</option>
              <option value="ENVIO_GRATIS">Envío Gratis</option>
            </select>
          </div>
        </div>

        {activePromotions.length === 0 && expiredPromotions.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No hay promociones disponibles</h2>
            <p className="text-gray-500">Vuelve a consultar más tarde para ver nuevas ofertas.</p>
          </div>
        ) : (
          <>
            {activePromotions.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-600" />
                  Promociones Activas ({activePromotions.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activePromotions.map((promo) => (
                    <PromotionCard key={promo.id} promo={promo} />
                  ))}
                </div>
              </div>
            )}

            {expiredPromotions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-gray-400">Promociones Vencidas</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{expiredPromotions.length}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {expiredPromotions.map((promo) => (
                    <PromotionCard key={promo.id} promo={promo} expired />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

interface PromotionCardProps {
  promo: Promotion;
  expired?: boolean;
}

function PromotionCard({ promo, expired }: PromotionCardProps) {
  const Icon = typeIcons[promo.type] || Sparkles;
  const color = typeColors[promo.type] || 'bg-gray-500';
  const daysLeft = Math.ceil((new Date(promo.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', expired && 'opacity-60')}>
      {!expired && daysLeft <= 7 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1">
          <span className="text-xs text-amber-700 font-medium">Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}</span>
        </div>
      )}
      <div className={cn('p-4', expired && 'bg-gray-50')}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', color)}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className={cn('font-semibold text-gray-900', expired && 'line-through text-gray-400')}>{promo.name}</h3>
              <p className="text-xs text-gray-500">{typeLabels[promo.type] || promo.type}</p>
            </div>
          </div>
          <span className={cn('text-xs font-medium px-2 py-1 rounded-full', expired ? 'bg-gray-100 text-gray-500' : 'bg-primary-100 text-primary-700')}>
            {expired ? 'Vencida' : `Vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`}
          </span>
        </div>
        <p className={cn('text-sm text-gray-600 mb-3', expired && 'text-gray-400 line-through')}>{promo.description}</p>
        <div className="flex flex-wrap gap-2 text-sm">
          {promo.multiplier > 1 && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
              <Zap className="w-3 h-3 inline mr-1" /> x{promo.multiplier}
            </span>
          )}
          {promo.bonusPoints > 0 && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
              <Award className="w-3 h-3 inline mr-1" /> +{promo.bonusPoints}
            </span>
          )}
          {promo.discount > 0 && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
              <Sparkles className="w-3 h-3 inline mr-1" /> -{promo.discount}%
            </span>
          )}
        </div>
        {(promo.categories.length > 0 || promo.brands.length > 0) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Aplicable a:</p>
            <div className="flex flex-wrap gap-1">
              {promo.categories.slice(0, 3).map(cat => (
                <span key={cat} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{cat}</span>
              ))}
              {promo.brands.slice(0, 2).map(brand => (
                <span key={brand} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{brand}</span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          Válida hasta: {new Date(promo.endDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}