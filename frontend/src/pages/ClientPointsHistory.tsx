import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn, formatNumber, formatDateTime } from '../lib/utils';
import { ArrowLeft, Award, Loader2, AlertTriangle, TrendingUp, TrendingDown, ShoppingBag, Settings2, Scissors, Clock, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Movement {
  id: string;
  source: 'COMPRA' | 'AJUSTE' | 'CANJE' | 'VENCIMIENTO';
  type: string;
  description: string;
  points: number;
  balanceAfter: number | null;
  createdAt: string;
}

interface HistoryData {
  currentPoints: number;
  totalEarned: number;
  totalSpent: number;
  movements: Movement[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const sourceConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  COMPRA: { icon: ShoppingBag, color: 'bg-green-100 text-green-600', label: 'Compra' },
  AJUSTE: { icon: Settings2, color: 'bg-blue-100 text-blue-600', label: 'Ajuste' },
  CANJE: { icon: Scissors, color: 'bg-amber-100 text-amber-600', label: 'Canje' },
  VENCIMIENTO: { icon: Clock, color: 'bg-red-100 text-red-600', label: 'Vencimiento' },
};

export default function ClientPointsHistory() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [onlyEarned, setOnlyEarned] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchHistory(true);
  }, [isAuthenticated, onlyEarned]);

  const fetchHistory = async (reset: boolean, page = 1) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const response = await api.get<HistoryData>(`/client/points-history?page=${page}&limit=20${onlyEarned ? '&type=ACREDITACION' : ''}`);
      setData(prev => {
        if (reset || !prev || page === 1) return response.data;
        return {
          ...response.data,
          movements: [...prev.movements, ...response.data.movements],
        };
      });
    } catch (err: any) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error al cargar el historial');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!data) return;
    fetchHistory(false, data.pagination.page + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Mis Puntos</h1>
              <p className="text-sm text-gray-500">Historial de movimientos</p>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse h-16 bg-white rounded-xl border border-gray-200" />
          ))}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate('/app/home')} className="btn-primary">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/app/home')} className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Mis Puntos</h1>
                <p className="text-sm text-gray-500">Historial de movimientos</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Saldo actual</p>
              <p className="text-2xl font-bold text-primary-600">{formatNumber(data?.currentPoints || 0)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-16">
        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Total acreditado
            </div>
            <p className="text-2xl font-bold text-green-600">+{formatNumber(data?.totalEarned || 0)}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Total canjeado
            </div>
            <p className="text-2xl font-bold text-red-500">-{formatNumber(data?.totalSpent || 0)}</p>
          </div>
        </div>

        {/* Filtro */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setOnlyEarned(false)}
            className={cn('px-4 py-2 rounded-full text-sm font-medium', !onlyEarned ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}
          >
            Todos
          </button>
          <button
            onClick={() => setOnlyEarned(true)}
            className={cn('px-4 py-2 rounded-full text-sm font-medium', onlyEarned ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}
          >
            Puntos acreditados
          </button>
        </div>

        {/* Movimientos */}
        {(!data || data.movements.length === 0) ? (
          <div className="text-center py-12">
            <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Sin movimientos todavía</h2>
            <p className="text-gray-500">Cuando hagas compras vas a ver aquí tus puntos acreditados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.movements.map(m => {
              const cfg = sourceConfig[m.source] || sourceConfig.AJUSTE;
              const Icon = cfg.icon;
              const positive = m.points > 0;
              return (
                <div key={m.id} className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('p-2 rounded-lg shrink-0', cfg.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{m.description}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(m.createdAt)} · {cfg.label}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('font-bold', positive ? 'text-green-600' : 'text-red-500')}>
                      {positive ? '+' : '-'}{formatNumber(Math.abs(m.points))} pts
                    </p>
                    {m.balanceAfter !== null && (
                      <p className="text-xs text-gray-400">Saldo: {formatNumber(m.balanceAfter)}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {data.pagination.page < data.pagination.pages && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                Cargar más
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
