import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn, formatNumber, formatCurrency, formatDateTime } from '../lib/utils';
import { 
  Award, Zap, Sparkles, Gift, TrendingUp,
  Ticket, CreditCard, Trophy, AlertTriangle, ChevronRight, Target,
  Shield, Crown, Crown as CrownIcon, Heart
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import ClientHeader from '../components/ClientHeader';
import PromotionCarousel from '../components/PromotionCarousel';

interface NextGoal {
  id: string;
  name: string;
  imageUrl?: string;
  pointsCost: number;
  pointsMissing: number;
}

interface HomeData {
  client: {
    firstName: string;
    lastName: string;
    dni: string;
    email: string;
    phone: string;
    birthDate: string;
  };
  profile: {
    currentPoints: number;
    totalPointsEarned: number;
    totalPointsRedeemed: number;
    lastPurchaseAt: string | null;
  };
  stats: {
    activePromotions: number;
    activeChallenges: number;
    availableCoupons: number;
    expiringCoupons: number;
  };
  promotions: Array<{
    id: string;
    name: string;
    description?: string;
    imageUrl?: string | null;
    type: string;
    multiplier: number;
    bonusPoints: number;
    discount: number;
    endDate: string;
  }>;
  challenges: Array<{
    id: string;
    name: string;
    description: string;
    imageUrl?: string | null;
    type: string;
    target: number;
    progress: number;
    completed: boolean;
    rewardPoints: number;
    endDate: string;
  }>;
  coupons: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    value: number;
    endDate: string;
  }>;
  expiringCoupons: Array<{
    id: string;
    code: string;
    name: string;
    daysLeft: number;
  }>;
  recentPurchases: Array<{
    id: string;
    receiptNumber: string;
    total: number;
    pointsEarned: number;
    createdAt: string;
  }>;
  benefits: Array<{
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
    type: string;
    value: number;
    autoApply: boolean;
    endDate: string | null;
  }>;
}

const typeLabels: Record<string, string> = {
  DOBLE_PUNTOS: 'Doble Puntos',
  TRIPLE_PUNTOS: 'Triple Puntos',
  PUNTOS_EXTRA: 'Puntos Extra',
  DESCUENTO_PORCENTUAL: 'Descuento %',
  PRODUCTO_BONIFICADO: 'Producto Bonificado',
  ENVIO_GRATIS: 'Envío Gratis',
  MULTIPLICADOR_PUNTOS: 'Multiplicador Puntos',
  ACCESO_ANTICIPADO: 'Acceso Anticipado',
  REGALO_CUMPLEANOS: 'Regalo Cumpleaños',
  ATENCION_PRIORITARIA: 'Atención Prioritaria',
};

const typeColors: Record<string, string> = {
  DOBLE_PUNTOS: 'bg-purple-500',
  TRIPLE_PUNTOS: 'bg-purple-600',
  PUNTOS_EXTRA: 'bg-amber-500',
  DESCUENTO_PORCENTUAL: 'bg-green-500',
  PRODUCTO_BONIFICADO: 'bg-blue-500',
  ENVIO_GRATIS: 'bg-cyan-500',
  MULTIPLICADOR_PUNTOS: 'bg-indigo-500',
  ACCESO_ANTICIPADO: 'bg-violet-500',
  REGALO_CUMPLEANOS: 'bg-pink-500',
  ATENCION_PRIORITARIA: 'bg-red-500',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  DOBLE_PUNTOS: Zap,
  TRIPLE_PUNTOS: Zap,
  PUNTOS_EXTRA: Award,
  DESCUENTO_PORCENTUAL: Sparkles,
  PRODUCTO_BONIFICADO: Gift,
  ENVIO_GRATIS: Ticket,
  MULTIPLICADOR_PUNTOS: CrownIcon,
  ACCESO_ANTICIPADO: Shield,
  REGALO_CUMPLEANOS: Heart,
  ATENCION_PRIORITARIA: Crown,
};

const challengeTypeLabels: Record<string, string> = {
  CANTIDAD_PRODUCTOS: 'Productos',
  CANTIDAD_COMPRAS: 'Compras',
  MARCAS_DIFERENTES: 'Marcas',
  CATEGORIAS_DIFERENTES: 'Categorías',
  MONTO_ACUMULADO: 'Monto',
  FRECUENCIA_COMPRA: 'Frecuencia',
};

export default function ClientHome() {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser } = useAuthStore();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prizesAvailable, setPrizesAvailable] = useState(0);
  const [nextGoal, setNextGoal] = useState<NextGoal | null>(null);

  useEffect(() => {
    if (isAuthenticated && !user) {
      refreshUser();
    }
  }, [isAuthenticated, user, refreshUser]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchHome = async () => {
      setLoading(true);
      try {
        const response = await api.get('/client/home');
        setData(response.data);
      } catch (err: any) {
        if (err.response?.status === 401) {
          navigate('/login');
        } else {
          setError(err.response?.data?.error || 'Error al cargar el home');
        }
      } finally {
        setLoading(false);
      }
    };

    const fetchPrizesSummary = async () => {
      try {
        const response = await api.get('/client/prizes');
        setPrizesAvailable(response.data.prizes.filter((p: any) => p.canAfford).length);
        setNextGoal(response.data.nextGoal);
      } catch {
        // No bloquea el home
      }
    };

    fetchHome();
    fetchPrizesSummary();
  }, [isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-24 bg-gray-200 rounded-xl" />
              <div className="h-24 bg-gray-200 rounded-xl" />
              <div className="h-24 bg-gray-200 rounded-xl" />
            </div>
            <div className="h-32 bg-gray-200 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-24 bg-gray-200 rounded-xl" />
              <div className="h-24 bg-gray-200 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button onClick={() => navigate('/login')} className="btn-primary">
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { client, profile, stats, promotions, challenges, coupons, expiringCoupons, recentPurchases, benefits } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <ClientHeader
        subtitle="Tu club de beneficios"
        right={
          <div className="text-right">
            <p className="text-sm text-gray-500">Hola, {client.firstName}</p>
            <p className="text-xs text-gray-400">DNI: {client.dni}</p>
          </div>
        }
      />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-20">
        {/* Points Header */}
        <div className="relative mb-6">
          <div className="rounded-2xl bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Puntos disponibles</p>
                <p className="mt-1 text-4xl font-bold">{formatNumber(profile.currentPoints)}</p>
                <p className="mt-1 text-sm opacity-90">
                  <Award className="w-4 h-4 inline mr-1" /> {formatNumber(profile.totalPointsEarned)} ganados · {formatNumber(profile.totalPointsRedeemed)} canjeados
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Próximo objetivo de canje */}
        {nextGoal && (
          <button
            onClick={() => navigate('/app/prizes')}
            className="block w-full text-left mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs opacity-90">Próximo objetivo</p>
                  <p className="font-semibold">{nextGoal.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-90">Te faltan</p>
                <p className="font-bold">{formatNumber(nextGoal.pointsMissing)} pts</p>
              </div>
            </div>
          </button>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <StatCard 
            icon={Gift} 
            label="Premios" 
            value={prizesAvailable} 
            color="bg-amber-500" 
            link="/app/prizes"
          />
          <StatCard 
            icon={TrendingUp} 
            label="Puntos ganados" 
            value={profile.totalPointsEarned} 
            color="bg-primary-600" 
            link="/app/points"
          />
          <StatCard 
            icon={Award} 
            label="Promociones" 
            value={stats.activePromotions} 
            color="bg-purple-500" 
            link="/app/promotions"
          />
          <StatCard 
            icon={Trophy} 
            label="Desafíos" 
            value={stats.activeChallenges} 
            color="bg-yellow-500" 
            link="/app/challenges"
          />
          <StatCard 
            icon={Ticket} 
            label="Cupones" 
            value={stats.availableCoupons} 
            color="bg-green-500" 
            link="/app/coupons"
          />
          <StatCard 
            icon={AlertTriangle} 
            label="Por vencer" 
            value={stats.expiringCoupons} 
            color="bg-red-500" 
            link="/app/coupons"
          />
        </div>

        {/* Promociones */}
        {(promotions.length > 0 || challenges.length > 0 || coupons.length > 0) && (
          <div className="space-y-6">
            {promotions.length > 0 && (
              <SectionHeader title="Promociones Activas" link="/app/promotions" icon={Sparkles} />
            )}
            {promotions.length > 0 && (
              <PromotionCarousel promotions={promotions} />
            )}

            {challenges.length > 0 && (
              <SectionHeader title="Mis Desafíos" link="/app/challenges" icon={Trophy} />
            )}
            {challenges.length > 0 && (
              <div className="space-y-3">
                {challenges.slice(0, 3).map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            )}

            {coupons.length > 0 && (
              <SectionHeader title="Mis Cupones" link="/app/coupons" icon={Ticket} />
            )}
            {coupons.length > 0 && (
              <div className="space-y-3">
                {coupons.slice(0, 3).map((coupon) => (
                  <CouponCard key={coupon.id} coupon={coupon} />
                ))}
              </div>
            )}

            {expiringCoupons.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-800">Cupones por vencer</h3>
                </div>
                <div className="space-y-2">
                  {expiringCoupons.map((coupon) => (
                    <div key={coupon.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-amber-500" />
                        <div>
                          <p className="font-medium text-gray-900">{coupon.name}</p>
                          <p className="text-xs text-gray-500">Código: {coupon.code}</p>
                        </div>
                      </div>
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        coupon.daysLeft <= 1 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {coupon.daysLeft} día{coupon.daysLeft !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {benefits.length > 0 && (
              <SectionHeader title="Mis Beneficios" icon={Shield} />
            )}
            {benefits.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {benefits.slice(0, 4).map((benefit) => (
                  <BenefitCard key={benefit.id} benefit={benefit} />
                ))}
              </div>
            )}

            {recentPurchases.length > 0 && (
              <SectionHeader title="Últimas Compras" link="/app/purchases" icon={CreditCard} />
            )}
            {recentPurchases.length > 0 && (
              <div className="space-y-2">
                {recentPurchases.slice(0, 3).map((purchase) => (
                  <PurchaseRow key={purchase.id} purchase={purchase} />
                ))}
              </div>
            )}
          </div>
        )}

        {!promotions.length && !challenges.length && !coupons.length && !recentPurchases.length && !benefits.length && (
          <div className="text-center py-12">
            <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Bienvenido a Robles Club!</h2>
            <p className="text-gray-500 mb-6">Comienza a comprar para ganar puntos, subir de nivel y desbloquear beneficios exclusivos.</p>
            <button onClick={() => navigate('/app/qr')} className="btn-primary px-6 py-3">
              Mostrar mi QR en caja para empezar a sumar
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  link: string;
}

function StatCard({ icon: Icon, label, value, color, link }: StatCardProps) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(link)}
      className={cn(
        'p-4 rounded-xl bg-white border border-gray-200 transition-all hover:shadow-md hover:-translate-y-0.5',
        'flex flex-col items-center text-center'
      )}
    >
      <div className={cn('p-3 rounded-xl', color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{formatNumber(value)}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </button>
  );
}

interface ChallengeCardProps {
  challenge: {
    id: string;
    name: string;
    description: string;
    imageUrl?: string | null;
    type: string;
    target: number;
    progress: number;
    completed: boolean;
    endDate: string;
  };
}

function ChallengeCard({ challenge }: ChallengeCardProps) {
  const progressPercent = Math.min(100, (challenge.progress / challenge.target) * 100);
  
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', challenge.completed && 'bg-green-50 border-green-200')}>
      {challenge.imageUrl && (
        <div className="aspect-[16/9] bg-gray-50 border-b border-gray-100 p-2">
          <img src={challenge.imageUrl} alt={challenge.name} className="w-full h-full object-contain" loading="lazy" />
        </div>
      )}
      <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Trophy className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{challenge.name}</h3>
            <p className="text-xs text-gray-500">{challengeTypeLabels[challenge.type] || challenge.type}</p>
          </div>
        </div>
        {challenge.completed && (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            Completado
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-3">{challenge.description}</p>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div 
          className={cn('h-full rounded-full transition-all duration-500', challenge.completed ? 'bg-green-500' : 'bg-primary-500')}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{challenge.progress} / {challenge.target}</span>
      </div>
      </div>
    </div>
  );
}

interface CouponCardProps {
  coupon: {
    id: string;
    code: string;
    name: string;
    type: string;
    value: number;
    endDate: string;
  };
}

function CouponCard({ coupon }: CouponCardProps) {
  const daysLeft = Math.ceil((new Date(coupon.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  return (
    <div className="p-4 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-100 rounded-lg">
          <Ticket className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{coupon.name}</h3>
          <p className="text-xs text-gray-500">Código: {coupon.code}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          {coupon.type === 'DESCUENTO_PORCENTUAL' ? `-${coupon.value}%` : 
           coupon.type === 'PUNTOS_BONUS' ? `+${coupon.value} pts` : coupon.value}
        </span>
        <span className={cn(
          'px-2 py-1 rounded-full text-xs font-medium',
          daysLeft <= 1 ? 'bg-red-100 text-red-700' : 
          daysLeft <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
        )}>
          {daysLeft} día{daysLeft !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

interface BenefitCardProps {
  benefit: {
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
    type: string;
    value: number;
    autoApply: boolean;
    endDate: string | null;
  };
}

function BenefitCard({ benefit }: BenefitCardProps) {
  const Icon = typeIcons[benefit.type] || Shield;
  const color = typeColors[benefit.type] || 'bg-gray-500';
  const daysLeft = benefit.endDate ? Math.ceil((new Date(benefit.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', color)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{benefit.name}</h3>
            <p className="text-xs text-gray-500">{typeLabels[benefit.type] || benefit.type}</p>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{benefit.description}</p>
      <div className="flex items-center gap-2 text-sm">
        {benefit.type === 'DESCUENTO_PORCENTUAL' && (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
            <Sparkles className="w-3 h-3 inline mr-1" /> -{benefit.value}%
          </span>
        )}
        {benefit.type === 'MULTIPLICADOR_PUNTOS' && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
            <Zap className="w-3 h-3 inline mr-1" /> x{benefit.value}
          </span>
        )}
        {benefit.type === 'ENVIO_GRATIS' && (
          <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded-full">
            <Gift className="w-3 h-3 inline mr-1" /> Envío Gratis
          </span>
        )}
        {benefit.type === 'PRODUCTO_BONIFICADO' && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
            <Gift className="w-3 h-3 inline mr-1" /> Producto Bonificado
          </span>
        )}
        {benefit.type === 'ACCESO_ANTICIPADO' && (
          <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded-full">
            <Shield className="w-3 h-3 inline mr-1" /> Acceso Anticipado
          </span>
        )}
        {benefit.type === 'REGALO_CUMPLEANOS' && (
          <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-full">
            <Heart className="w-3 h-3 inline mr-1" /> Regalo Cumpleaños
          </span>
        )}
        {benefit.type === 'ATENCION_PRIORITARIA' && (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
            <Crown className="w-3 h-3 inline mr-1" /> Atención Prioritaria
          </span>
        )}
        {daysLeft !== null && daysLeft > 0 && (
          <span className={cn(
            'px-2 py-1 rounded-full text-xs font-medium ml-auto',
            daysLeft <= 1 ? 'bg-red-100 text-red-700' : 
            daysLeft <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
          )}>
            {daysLeft} día{daysLeft !== 1 ? 's' : ''}
          </span>
        )}
        {benefit.autoApply && (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">
            Automático
          </span>
        )}
      </div>
    </div>
  );
}

interface PurchaseRowProps {
  purchase: {
    id: string;
    receiptNumber: string;
    total: number;
    pointsEarned: number;
    createdAt: string;
  };
}

function PurchaseRow({ purchase }: PurchaseRowProps) {
  return (
    <div className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-gray-400" />
        <div>
          <p className="font-medium text-gray-900">{purchase.receiptNumber}</p>
          <p className="text-xs text-gray-500">{formatDateTime(purchase.createdAt)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-gray-900">{formatCurrency(purchase.total)}</p>
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Award className="w-3 h-3" /> +{formatNumber(purchase.pointsEarned)}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ title, link, icon: Icon }: { title: string; link?: string; icon: React.ComponentType<{ className?: string }> }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Icon className="w-5 h-5 text-primary-600" />
        {title}
      </h2>
      {link && (
        <button onClick={() => navigate(link)} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
          Ver todas <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}