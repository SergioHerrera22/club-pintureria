import { useState, useEffect } from 'react';
import ClientHeader from '../components/ClientHeader';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn, formatNumber } from '../lib/utils';
import { ArrowLeft, Trophy, Target, Award, Zap, Flag, Search, CheckCircle, Clock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Challenge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: string;
  target: number;
  progress: number;
  completed: boolean;
  completedAt: string | null;
  rewardPoints: number;
  rewardCoupon: string | null;
  startDate: string;
  endDate: string;
}

const typeLabels: Record<string, string> = {
  CANTIDAD_PRODUCTOS: 'Productos',
  CANTIDAD_COMPRAS: 'Compras',
  MARCAS_DIFERENTES: 'Marcas',
  CATEGORIAS_DIFERENTES: 'Categorías',
  MONTO_ACUMULADO: 'Monto Acumulado',
  FRECUENCIA_COMPRA: 'Frecuencia',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  CANTIDAD_PRODUCTOS: Zap,
  CANTIDAD_COMPRAS: Trophy,
  MARCAS_DIFERENTES: Flag,
  CATEGORIAS_DIFERENTES: Award,
  MONTO_ACUMULADO: Target,
  FRECUENCIA_COMPRA: Clock,
};

export default function ClientChallenges() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchChallenges();
  }, [isAuthenticated]);

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const response = await api.get('/client/challenges');
      setChallenges(response.data.challenges);
    } catch (err: any) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error al cargar desafíos');
      }
    } finally {
      setLoading(false);
    }
  };

  const activeChallenges = challenges.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && !c.completed);
    return matchesSearch && matchesStatus;
  });

  const completedChallenges = challenges.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.description.toLowerCase().includes(search.toLowerCase());
    return c.completed && matchesSearch;
  });

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
                <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Desafíos</h1>
                  <p className="text-sm text-gray-500">Completa misiones y gana beneficios</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
                <div className="h-2 bg-gray-200 rounded mt-3" />
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
            <ClientHeader title="Mis Desafíos" subtitle={<>{activeChallenges.length} activos · {completedChallenges.length} completados</>} backTo="/app/home" maxWidth="4xl" />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <StatCard 
            icon={Trophy} 
            label="Activos" 
            value={activeChallenges.length} 
            color="bg-amber-500" 
          />
          <StatCard 
            icon={CheckCircle} 
            label="Completados" 
            value={completedChallenges.length} 
            color="bg-green-500" 
          />
        </div>

        <div className="mb-6 flex gap-3">
          <input
            type="text"
            placeholder="Buscar desafíos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input flex-1 pl-10 relative"
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="input w-40"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="completed">Completados</option>
          </select>
        </div>

        {challenges.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No hay desafíos disponibles</h2>
            <p className="text-gray-500">Completa desafíos para ganar puntos extra y recompensas exclusivas.</p>
          </div>
        ) : (
          <>
            {activeChallenges.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-600" />
                  Desafíos Activos ({activeChallenges.length})
                </h2>
                <div className="space-y-4">
                  {activeChallenges.map((challenge) => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              </div>
            )}

            {completedChallenges.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Completados ({completedChallenges.length})
                </h2>
                <div className="space-y-3">
                  {completedChallenges.map((challenge) => (
                    <ChallengeCard key={challenge.id} challenge={challenge} completed />
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

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
  return (
    <div className="p-4 bg-white rounded-xl border border-gray-200 text-center">
      <div className={cn('p-3 rounded-xl', color, 'mx-auto w-12 h-12')}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{formatNumber(value)}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

interface ChallengeCardProps {
  challenge: Challenge;
  completed?: boolean;
}

function ChallengeCard({ challenge, completed }: ChallengeCardProps) {
  const progressPercent = Math.min(100, (challenge.progress / challenge.target) * 100);
  const Icon = typeIcons[challenge.type] || Trophy;
  
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', challenge.completed && 'bg-green-50 border-green-200', completed && 'bg-green-50 border-green-200')}>
      {challenge.imageUrl && (
        <div className="aspect-[16/9] bg-gray-50 border-b border-gray-100 p-2">
          <img src={challenge.imageUrl} alt={challenge.name} className="w-full h-full object-contain" loading="lazy" />
        </div>
      )}
      <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Icon className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className={cn('font-semibold text-gray-900', challenge.completed && 'line-through text-gray-400')}>{challenge.name}</h3>
            <p className="text-xs text-gray-500">{typeLabels[challenge.type] || challenge.type}</p>
          </div>
        </div>
        {challenge.completed && (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3 inline mr-1" /> Completado
          </span>
        )}
      </div>
      <p className={cn('text-sm text-gray-600 mb-3', challenge.completed && 'text-gray-400 line-through')}>{challenge.description}</p>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div 
          className={cn('h-full rounded-full transition-all duration-500', challenge.completed ? 'bg-green-500' : 'bg-primary-500')}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={cn('text-gray-500', challenge.completed && 'text-gray-400')}>{challenge.progress} / {challenge.target}</span>
        {challenge.completed && (
          <span className="font-semibold text-green-600">¡Completado!</span>
        )}
      </div>
      {challenge.rewardCoupon && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-800">Recompensa extra: Cupón {challenge.rewardCoupon}</span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}