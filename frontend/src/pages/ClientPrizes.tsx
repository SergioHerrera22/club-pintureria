import { useState, useEffect } from 'react';
import ClientHeader from '../components/ClientHeader';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn, formatNumber } from '../lib/utils';
import { Gift, Award, Loader2, CheckCircle2, Lock, AlertTriangle, Target, Package } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface PrizeItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  imageUrl?: string;
  pointsCost: number;
  category: string;
  stock: number;
  canAfford: boolean;
  pointsMissing: number;
}

interface NextGoal {
  id: string;
  name: string;
  imageUrl?: string;
  pointsCost: number;
  pointsMissing: number;
}

interface PrizesData {
  currentPoints: number;
  prizes: PrizeItem[];
  nextGoal: NextGoal | null;
}

export default function ClientPrizes() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<PrizesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<PrizeItem | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchPrizes();
  }, [isAuthenticated]);

  const fetchPrizes = async () => {
    setLoading(true);
    try {
      const response = await api.get<PrizesData>('/client/prizes');
      setData(response.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error al cargar premios');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!selected) return;
    if (selected.pointsCost > (data?.currentPoints || 0)) {
      setRedeemResult({ ok: false, message: `Te faltan ${formatNumber(selected.pointsCost - (data?.currentPoints || 0))} puntos para canjear este premio` });
      return;
    }
    setRedeeming(true);
    setRedeemResult(null);
    try {
      const response = await api.post('/client/prizes/redeem', { prizeId: selected.id });
      setRedeemResult({ ok: true, message: response.data.message || '¡Canje realizado!' });
      await fetchPrizes();
    } catch (err: any) {
      setRedeemResult({ ok: false, message: err.response?.data?.error || 'Error al canjear' });
    } finally {
      setRedeeming(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setRedeemResult(null);
  };

  const categories = data ? Array.from(new Set(data.prizes.map(p => p.category))) : [];
  const visiblePrizes = data ? (category ? data.prizes.filter(p => p.category === category) : data.prizes) : [];
  const affordable = data ? data.prizes.filter(p => p.canAfford).length : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Premios</h1>
              <p className="text-sm text-gray-500">Catálogo para canjear tus puntos</p>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="h-40 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
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
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate('/app/home')} className="btn-primary">Volver</button>
        </div>
      </div>
    );
  }

  const goalProgress = data?.nextGoal
    ? Math.min(100, ((data.nextGoal.pointsCost - data.nextGoal.pointsMissing) / data.nextGoal.pointsCost) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-gray-50">
            <ClientHeader title="Premios" subtitle={<>{affordable} disponibles para canjear</>} backTo="/app/home" maxWidth="4xl" right={<div className="text-right">
              <p className="text-xs text-gray-500">Tus puntos</p>
              <p className="text-2xl font-bold text-primary-600">{formatNumber(data?.currentPoints || 0)}</p>
            </div>} />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-16">
        {/* Próximo objetivo */}
        {data?.nextGoal && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Target className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm opacity-90">Tu próximo objetivo</p>
                <p className="font-semibold">{data.nextGoal.name}</p>
              </div>
              {data.nextGoal.imageUrl && (
                <img src={data.nextGoal.imageUrl} alt={data.nextGoal.name} className="w-14 h-14 rounded-lg object-cover bg-white/20" />
              )}
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${goalProgress}%` }} />
            </div>
            <p className="text-sm">
              Te faltan <strong>{formatNumber(data.nextGoal.pointsMissing)} puntos</strong> para canjear este premio
            </p>
          </div>
        )}

        {/* Filtro por categoría */}
        {categories.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            <button
              onClick={() => setCategory('')}
              className={cn('px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap', !category ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}
            >
              Todos
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn('px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap', category === c ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {visiblePrizes.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No hay premios disponibles</h2>
            <p className="text-gray-500">Volvé a consultar más tarde.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visiblePrizes.map(prize => (
              <PrizeCard key={prize.id} prize={prize} currentPoints={data?.currentPoints || 0} onClick={() => setSelected(prize)} />
            ))}
          </div>
        )}
      </main>

      {/* Modal detalle / canje */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={closeDetail}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="relative">
              {selected.imageUrl ? (
                <img src={selected.imageUrl} alt={selected.name} className="w-full h-48 object-cover rounded-t-2xl" />
              ) : (
                <div className="w-full h-32 bg-amber-50 rounded-t-2xl flex items-center justify-center">
                  <Gift className="w-14 h-14 text-amber-300" />
                </div>
              )}
              <button onClick={closeDetail} className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-full text-gray-600 hover:text-gray-900">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs whitespace-nowrap">{selected.category}</span>
                </div>
                {selected.description && <p className="mt-1 text-sm text-gray-600">{selected.description}</p>}
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Award className="w-4 h-4 text-primary-600" />
                  Costo en puntos
                </div>
                <span className="font-bold text-primary-600">{formatNumber(selected.pointsCost)} pts</span>
              </div>

              {/* Progreso hacia este premio */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Tu saldo: {formatNumber(data?.currentPoints || 0)} pts</span>
                  <span>{selected.pointsCost} pts</span>
                </div>
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', selected.canAfford ? 'bg-green-500' : 'bg-amber-500')}
                    style={{ width: `${Math.min(100, ((data?.currentPoints || 0) / selected.pointsCost) * 100)}%` }}
                  />
                </div>
                <p className={cn('mt-2 text-sm font-medium text-center', selected.canAfford ? 'text-green-700' : 'text-amber-700')}>
                  {selected.canAfford
                    ? '¡Podés canjear este premio!'
                    : `Te faltan ${formatNumber(selected.pointsMissing)} puntos para canjearlo`}
                </p>
              </div>

              {redeemResult && (
                <div className={cn('p-3 rounded-lg text-sm flex items-start gap-2', redeemResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                  {redeemResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                  {redeemResult.message}
                </div>
              )}

              <button
                onClick={handleRedeem}
                disabled={redeeming || !selected.canAfford}
                className={cn(
                  'w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2',
                  selected.canAfford
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                {redeeming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : selected.canAfford ? (
                  <><CheckCircle2 className="w-5 h-5" /> Canjear ahora</>
                ) : (
                  <><Lock className="w-5 h-5" /> Te faltan {formatNumber(selected.pointsMissing)} pts</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrizeCard({ prize, currentPoints, onClick }: { prize: PrizeItem; currentPoints: number; onClick: () => void }) {
  const progress = Math.min(100, (currentPoints / prize.pointsCost) * 100);
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden text-left transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="relative h-36 bg-gray-100">
        {prize.imageUrl ? (
          <img src={prize.imageUrl} alt={prize.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gift className="w-10 h-10 text-gray-300" />
          </div>
        )}
        <span className={cn(
          'absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1',
          prize.canAfford ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
        )}>
          {prize.canAfford ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
          {prize.canAfford ? 'Disponible' : `Faltan ${formatNumber(prize.pointsMissing)}`}
        </span>
      </div>
      <div className="p-3">
        <p className="font-semibold text-gray-900 line-clamp-1">{prize.name}</p>
        <p className="text-xs text-gray-500 mb-2">{prize.category}</p>
        <div className="flex items-center justify-between">
          <span className="font-bold text-primary-600">{formatNumber(prize.pointsCost)} pts</span>
          <span className="text-xs text-gray-400">Stock: {prize.stock}</span>
        </div>
        {!prize.canAfford && (
          <div className="mt-2">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {formatNumber(currentPoints)} / {formatNumber(prize.pointsCost)} pts
            </p>
          </div>
        )}
      </div>
    </button>
  );
}
