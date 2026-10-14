import { useState, useEffect } from 'react';
import ClientHeader from '../components/ClientHeader';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn, formatNumber, formatCurrency, formatDateTime } from '../lib/utils';
import { ArrowLeft, CreditCard, Award, Search, ChevronLeft, ChevronRight, Eye, Calendar, Receipt } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Purchase {
  id: string;
  receiptNumber: string;
  total: number;
  pointsEarned: number;
  pointsBalance: number;
  status: string;
  createdAt: string;
  branch: { id: string; name: string; code: string };
  itemCount: number;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productCode: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    pointsEarned: number;
    promotionIds: string[];
  }>;
}

interface PurchasesResponse {
  purchases: Purchase[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function ClientPurchases() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<PurchasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchPurchases();
  }, [isAuthenticated, page, search, startDate, endDate]);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      const response = await api.get<PurchasesResponse>(`/client/purchases?${params.toString()}`);
      setData(response.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error al cargar compras');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <button onClick={() => navigate('/app/home')} className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Historial de Compras</h1>
                  <p className="text-sm text-gray-500">Ver tus compras y movimientos</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-6 bg-gray-200 rounded w-24" />
                    <div className="h-3 bg-gray-200 rounded w-20 mt-1" />
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

  const totalPoints = data?.purchases.reduce((sum, p) => sum + p.pointsEarned, 0) || 0;
  const totalSpent = data?.purchases.reduce((sum, p) => sum + p.total, 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
            <ClientHeader title="Historial de Compras" subtitle={<>{data?.pagination.total || 0} compras · {formatNumber(totalPoints)} pts ganados</>} backTo="/app/home" maxWidth="4xl" />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Receipt} label="Compras" value={data?.pagination.total || 0} color="bg-blue-500" />
          <StatCard icon={Award} label="Puntos Ganados" value={totalPoints} color="bg-purple-500" />
          <StatCard icon={CreditCard} label="Total Gastado" value={totalSpent} color="bg-green-500" format="currency" />
          <StatCard icon={Calendar} label="Promedio" value={data?.pagination.total ? Math.round(totalSpent / data.pagination.total) : 0} color="bg-amber-500" format="currency" />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por comprobante, sucursal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input pl-10"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input pl-10"
                />
              </div>
              <button onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); }} className="btn-outline flex items-center gap-1">
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {data?.purchases.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No hay compras registradas</h2>
            <p className="text-gray-500 mb-6">Tus compras aparecerán aquí automáticamente al realizar una compra.</p>
            <button onClick={() => navigate('/app/home')} className="btn-primary">
              Realizar una compra
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data?.purchases.map((purchase) => (
                <PurchaseCard key={purchase.id} purchase={purchase} />
              ))}
            </div>

            {/* Pagination */}
            {data && data.pagination.pages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(prev => prev - 1)}
                  disabled={data.pagination.page === 1}
                  className="btn-outline p-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded">
                  Página {data.pagination.page} de {data.pagination.pages}
                </span>
                <button
                  onClick={() => setPage(prev => prev + 1)}
                  disabled={data.pagination.page === data.pagination.pages}
                  className="btn-outline p-2"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, format = 'number' }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string; format?: 'number' | 'currency' }) {
  return (
    <div className="p-4 bg-white rounded-xl border border-gray-200 text-center">
      <div className={cn('p-3 rounded-xl', color, 'mx-auto w-12 h-12')}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{format === 'currency' ? formatCurrency(value) : formatNumber(value)}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

interface PurchaseCardProps {
  purchase: Purchase;
  onClick?: () => void;
}

function PurchaseCard({ purchase, onClick }: PurchaseCardProps) {
  const statusColors: Record<string, string> = {
    COMPLETADA: 'bg-green-100 text-green-700',
    CANCELADA: 'bg-red-100 text-red-700',
    PENDIENTE: 'bg-amber-100 text-amber-700',
    DEVUELTA: 'bg-gray-100 text-gray-700',
  };

  return (
    <button onClick={onClick} className={cn('w-full p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-primary-300 transition-all text-left', onClick && 'hover:shadow-md hover:border-primary-300')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Receipt className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{purchase.receiptNumber}</p>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <span>{purchase.branch.name}</span>
              <span className="text-gray-300">•</span>
              <span>{purchase.itemCount} productos</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-gray-900">{formatCurrency(purchase.total)}</p>
          <p className="text-sm text-green-600 flex items-center gap-1">
            <Award className="w-3 h-3" /> +{formatNumber(purchase.pointsEarned)} pts
          </p>
          <p className="text-xs text-gray-500 mt-1">{formatDateTime(purchase.createdAt)}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusColors[purchase.status] || 'bg-gray-100 text-gray-700')}>
          {purchase.status}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Eye className="w-3 h-3" />
          Ver detalle
        </span>
      </div>
    </button>
  );
}