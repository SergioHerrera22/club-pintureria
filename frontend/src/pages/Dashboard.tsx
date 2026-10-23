import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { DashboardStats } from '../types';
import { cn, formatCurrency, formatNumber, formatDate } from '../lib/utils';
import { useToast } from '../components/Toast';
import { Users, ShoppingCart, Award, TrendingUp, Plus, Receipt, Target, UserPlus } from 'lucide-react';

import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

const REPORT_TYPES = [
  { id: 'sucursal', label: 'Reporte por Sucursal' },
  { id: 'mensual', label: 'Reporte Mensual' },
  { id: 'cajera', label: 'Reporte por Cajera' },
];

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const MONTH_OPTIONS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const formatMonthPeriod = (period: string): string => {
  const month = Number(period.split('-')[1]);
  return MONTH_OPTIONS[month - 1]?.label || period;
};

const statCards = [
  { name: 'Clientes Activos', key: 'users.active', icon: Users, color: 'bg-blue-500' },
  { name: 'Puntos en Circulación', key: 'points.inCirculation', icon: Award, color: 'bg-amber-500', format: 'number' },
  { name: 'Ventas del Mes', key: 'sales.revenueThisMonth', icon: ShoppingCart, color: 'bg-green-500', format: 'currency' },
  { name: 'Compras Hoy', key: 'sales.purchasesToday', icon: TrendingUp, color: 'bg-purple-500' },
];

interface RecentPurchase {
  id: string;
  receiptNumber: string;
  total: number;
  pointsEarned: number;
  createdAt: string;
  client: { name: string; dni: string };
  branch: { name: string; code: string };
  itemCount: number;
  items: Array<{ productName: string; productCode: string; quantity: number }>;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface BranchSale {
  branchId: string;
  name: string;
  code: string;
  revenue: number;
  points: number;
  count: number;
}

interface MonthlySale {
  period: string;
  revenue: number;
  points: number;
  count: number;
}

interface CashierSale {
  cashierId: string;
  name: string;
  revenue: number;
  points: number;
  count: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reportType, setReportType] = useState('sucursal');
  const [selectedCajera, setSelectedCajera] = useState('todas');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [branchSales, setBranchSales] = useState<BranchSale[]>([]);
  // Para el gráfico de torta: las sucursales con facturación $0 generan sectores
  // de ancho cero y sus etiquetas se superponen entre sí. Se excluyen.
  const branchPieData = branchSales.filter((b) => Number(b.revenue) > 0);
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);
  const [cashierSales, setCashierSales] = useState<CashierSale[]>([]);
  
  const userRole = user?.role;
  const isAdmin = userRole === 'ADMIN';
  const panelTitle = isAdmin ? 'Panel de Administrador' : 'Panel de Cajera';
  const selectedBranchName = branches.find(b => b.id === selectedBranch)?.name || null;
  const filteredCashierSales = selectedCajera === 'todas' ? cashierSales : cashierSales.filter(c => c.cashierId === selectedCajera);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await api.get('/branches');
        const data = response.data;
        const branchList: Branch[] = Array.isArray(data) ? data : (data.branches || []);
        setBranches(branchList);
        // NO se auto-selecciona la primera sucursal: por defecto se muestra
        // "Todas las sucursales" (sin filtro) para que el dashboard refleje
        // todos los datos. El backend fuerza la sucursal a cajeras/vendedores.
        } catch (err: any) {
        console.error('Error fetching branches:', err);
      }
    };
    
    fetchBranches();
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError('');
      try {
        const params: any = {};
        if (selectedBranch) params.branchId = selectedBranch;
        
        // Fetch stats data
        const statsResponse = await api.get<DashboardStats>('/dashboard/stats', { params });
        setStats(statsResponse.data);
        
        // Fetch recent purchases
        const recentResponse = await api.get<RecentPurchase[]>('/dashboard/recent-purchases', { params: { ...params, limit: 5 } });
        setRecentPurchases(recentResponse.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, [selectedBranch, refreshKey]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const params: any = { limit: 5 };
        if (selectedBranch) params.branchId = selectedBranch;
        const response = await api.get<RecentPurchase[]>('/dashboard/recent-purchases', { params });
        setRecentPurchases(response.data);
      } catch {
        // Silently fail for recent purchases
      } finally {
        setRecentLoading(false);
      }
    };
    
    fetchRecent();
  }, [selectedBranch]);

  useEffect(() => {
    const fetchBranchSales = async () => {
      try {
        const params: any = {};
        if (selectedBranch) params.branchId = selectedBranch;
        const response = await api.get('/dashboard/sales-by-branch', { params });
        const data = response.data;
        setBranchSales(Array.isArray(data) ? data : (data.branches || []));
      } catch (err) {
        console.error('Error fetching branch sales:', err);
      }
    };

    fetchBranchSales();
  }, [selectedBranch]);

  useEffect(() => {
    const fetchMonthlySales = async () => {
      try {
        const params: any = { groupBy: 'month' };
        if (selectedBranch) params.branchId = selectedBranch;
        if (selectedMonth) {
          const [year, month] = selectedMonth.split('-').map(Number);
          const lastDay = new Date(year, month, 0).getDate();
          params.from = `${selectedMonth}-01`;
          params.to = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
        }
        const response = await api.get('/dashboard/sales-report', { params });
        setMonthlySales(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error fetching monthly sales:', err);
      }
    };

    fetchMonthlySales();
  }, [selectedBranch, selectedMonth]);

  useEffect(() => {
    const fetchCashierSales = async () => {
      try {
        const params: any = {};
        if (selectedBranch) params.branchId = selectedBranch;
        const response = await api.get('/dashboard/sales-by-cashier', { params });
        const data = response.data;
        setCashierSales(Array.isArray(data) ? data : (data.cashiers || []));
      } catch (err) {
        console.error('Error fetching cashier sales:', err);
      }
    };

    fetchCashierSales();
  }, [selectedBranch]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: any = {};
      if (selectedBranch) params.branchId = selectedBranch;
      
      // Fetch data and generate CSV client-side
      const response = await api.get('/dashboard/stats', { params, timeout: 10000 });
      const data = response.data;
      
      // Generate CSV content
      const rows: string[] = [];
      
      // Stats section
      rows.push('=== DASHBOARD STATS ===');
      rows.push(`users.total,${data.users.total}`);
      rows.push(`users.active,${data.users.active}`);
      rows.push(`users.newThisMonth,${data.users.newThisMonth}`);
      rows.push(`points.totalEarned,${data.points.totalEarned}`);
      rows.push(`points.totalRedeemed,${data.points.totalRedeemed}`);
      rows.push(`points.inCirculation,${data.points.inCirculation}`);
      rows.push(`sales.totalPurchases,${data.sales.totalPurchases}`);
      rows.push(`sales.revenueThisMonth,${(data.sales.revenueThisMonth || 0).toFixed(2)}`);
      rows.push(`sales.purchasesToday,${data.sales.purchasesToday}`);
      rows.push('');
      
      // Top clients
      rows.push('=== TOP CLIENTS ===');
      rows.push('rank,dni,name,points');
      (data.topClients || []).slice(0, 5).forEach((client: any, idx: number) => {
        rows.push(`${idx + 1},${client.dni},${client.name.replace(/, /g, '')},${client.currentPoints}`);
      });
      rows.push('');
      
      // Low stock prizes
      rows.push('=== LOW STOCK PRIZES ===');
      rows.push('name,pointsCost,stock');
      (data.lowStockPrizes || []).forEach((prize: any) => {
        rows.push(`${prize.name.replace(/, /g, '')},${prize.pointsCost},${prize.stock}`);
      });
      rows.push('');
      
      // Recent purchases
      rows.push('=== RECENT PURCHASES ===');
      rows.push('receiptNumber,clientDNI,total,pointsEarned,branch,date');
      (recentPurchases || []).forEach((p: any) => {
        const branchName = p.branch?.name || 'N/A';
        rows.push(`'${p.receiptNumber}','${p.client.dni}','${Number(p.total).toFixed(2)}','${p.pointsEarned}','${branchName.replace(/, /g, '')}','${formatDate(p.createdAt)}'`);
      });
      rows.push('');
      
      const csvContent = rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-sucursal-${selectedBranch || 'todas'}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      toast('error', 'Error al generar el reporte. Verifica la consola.');
    } finally {
      setExporting(false);
    }
  };

  const getValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  };
  
  const formatValue = (value: number, format?: string) => {
    if (format === 'currency') return formatCurrency(value);
    if (format === 'number') return formatNumber(value);
    return formatNumber(value);
  };

  // Spinner/loading overlay when exporting
  if (exporting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-lg text-gray-700">Generando reporte...</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 animate-pulse h-64" />
          <div className="card p-6 animate-pulse h-64" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <p className="text-gray-500 text-sm mb-4">
          Esto puede deberse a una falla temporal de conexión. Intentá nuevamente.
        </p>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{panelTitle}</h1>
          <p className="text-gray-500 mt-1">Resumen rápido y accesos directos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/clients')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Compra
          </button>
          
          {/* Report Type Selector */}
          <div className="ml-4 relative">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="bg-white rounded px-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Branch Selector */}
          {branches.length > 0 && (
            <div className="ml-4 relative">
              <select
                value={selectedBranch || ''}
                onChange={(e) => {
                  const branchId = e.target.value || null;
                  setSelectedBranch(branchId);
                  setSelectedMonth(null);
                  setSelectedCajera('todas');
                }}
                className="bg-white rounded px-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Cajera Selector */}
          <div className="ml-4 relative">
            <select
              value={selectedCajera}
              onChange={(e) => setSelectedCajera(e.target.value)}
              className="bg-white rounded px-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="todas">Todas las cajeras</option>
              <option value="cajera1">Cajera 1</option>
              <option value="cajera2">Cajera 2</option>
              <option value="cajera3">Cajera 3</option>
            </select>
          </div>
          
          {/* Month Selector - shown for reporte mensual */}
          {reportType === 'mensual' && selectedMonth && (
            <div className="ml-4 relative">
              <span className="text-sm text-gray-500">Mes: {selectedMonth}</span>
            </div>
          )}
          
          
</div>
      </div>
      
      {/* Vistas de Reportes Condicionales */}
      {reportType === 'sucursal' && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card" style={{ height: '400px' }}>
              <div className="card-header">
                <span className="card-title">Ventas por Sucursal</span>
              </div>
              <div className="card-content" style={{ height: 'calc(100% - 56px)', padding: '0 16px 16px' }}>
                {branchSales.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No hay ventas registradas para este filtro</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchSales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} />
                      <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} formatter={(value: any) => [`$${value.toLocaleString()}`, 'Total']} />
                      <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card" style={{ height: '400px' }}>
              <div className="card-header">
                <span className="card-title">Distribución por Sucursal</span>
              </div>
              <div className="card-content" style={{ height: 'calc(100% - 56px)', padding: '0 16px 16px' }}>
                {branchPieData.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No hay ventas registradas para este filtro</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={branchPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="revenue" nameKey="name" label={({ name, percent }: { name?: string; percent?: number }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {branchPieData.map((_entry, i) => (<Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Total']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'mensual' && (
        <div style={{ marginBottom: '24px' }}>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-content" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="input" style={{ minWidth: '200px' }} value={selectedMonth || ''} onChange={(e) => setSelectedMonth(e.target.value || null)}>
                  <option value="">Todos los meses ({currentYear})</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={`${currentYear}-${m.value}`}>{m.label} {currentYear}</option>
                  ))}
                </select>
                <select className="input" style={{ minWidth: '200px' }} value={selectedBranch || ''} onChange={(e) => setSelectedBranch(e.target.value || null)}>
                  <option value="">Todas las sucursales</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ height: '400px' }}>
            <div className="card-header">
              <span className="card-title">Ventas por Mes{selectedBranchName ? ` — ${selectedBranchName}` : ''}</span>
            </div>
            <div className="card-content" style={{ height: 'calc(100% - 56px)', padding: '0 16px 16px' }}>
              {monthlySales.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No hay ventas registradas para este filtro</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} tickFormatter={(p: string) => formatMonthPeriod(p)} />
                    <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} formatter={(value: any) => [`$${value.toLocaleString()}`, 'Total']} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {reportType === 'cajera' && (
        <div style={{ marginBottom: '24px' }}>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-content" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="input" style={{ minWidth: '200px' }} value={selectedCajera} onChange={(e) => setSelectedCajera(e.target.value)}>
                  <option value="todas">Todas las cajeras</option>
                  {cashierSales.map((c) => (
                    <option key={c.cashierId} value={c.cashierId}>{c.name}</option>
                  ))}
                </select>
                <select className="input" style={{ minWidth: '200px' }} value={selectedBranch || ''} onChange={(e) => setSelectedBranch(e.target.value || null)}>
                  <option value="">Todas las sucursales</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {filteredCashierSales.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">No hay ventas registradas para este filtro</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                {filteredCashierSales.map((c) => (
                  <div key={c.cashierId} className="card" style={{ padding: '20px' }}>
                    <div className="card-header">
                      <span className="card-title">{c.name}</span>
                    </div>
                    <div className="card-content" style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '700' }}>{formatCurrency(c.revenue)}</div>
                        <div style={{ color: 'var(--color-text-muted)' }}>Ventas</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '700' }}>{formatNumber(c.points)}</div>
                        <div style={{ color: 'var(--color-text-muted)' }}>Puntos otorgados</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '700' }}>{formatNumber(c.count)}</div>
                        <div style={{ color: 'var(--color-text-muted)' }}>Compras</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ height: '400px' }}>
                <div className="card-header">
                  <span className="card-title">Ventas por Cajera{selectedBranchName ? ` — ${selectedBranchName}` : ''}</span>
                </div>
                <div className="card-content" style={{ height: 'calc(100% - 56px)', padding: '0 16px 16px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashierSales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} />
                      <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} formatter={(value: any) => [`$${value.toLocaleString()}`, 'Total']} />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const value = getValue(stats, card.key) || 0;

          return (
            <div key={card.name} className="card p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-current/10 rounded-full" style={{ backgroundImage: `linear-gradient(to bottom right, transparent, ${card.color.replace('500', '200')}33)` }} />
              <div className="flex items-center justify-between relative">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.name}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {formatValue(value, card.format)}
                  </p>
                </div>
                <div className={cn('p-3 rounded-xl', card.color.replace('500', '100'))}>
                  <card.icon className={cn('w-6 h-6', card.color.replace('500', '600'))} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Main Grid: Recent Purchases + Top Clients / Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Purchases - Full Width on Mobile, 2/3 on Desktop */}
        <div className="lg:col-span-2 card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Receipt className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Últimas 5 Compras</h2>
            </div>
            <button
              onClick={() => navigate('/clients')}
              className="text-sm text-primary-600 hover:underline flex items-center gap-1"
            >
              Ver todas <span className="hidden sm:inline">→</span>
            </button>
          </div>
          
          {recentLoading ? (
            <div className="divide-y divide-gray-200">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-32" />
                        <div className="h-3 bg-gray-200 rounded w-20 mt-1" />
                      </div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentPurchases.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-900 mb-1">No hay compras registradas</p>
              <p className="text-sm">Las compras aparecerán aquí automáticamente</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {recentPurchases.map((purchase, index) => (
                <div 
                  key={purchase.id} 
                  className={cn('p-4 flex items-center justify-between hover:bg-gray-50 transition-colors', index === 0 && 'bg-primary-50/50')}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0',
                      index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                    )}>
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{purchase.client.name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <span>DNI: {purchase.client.dni}</span>
                        <span className="text-primary-600 font-medium">+{formatNumber(purchase.pointsEarned)} pts</span>
                        <span className="text-gray-400">{purchase.itemCount} prod.</span>
                        <span className="text-gray-400">{purchase.branch.name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-semibold text-gray-900">{formatCurrency(purchase.total)}</p>
                    <p className="text-xs text-gray-500">{formatDate(purchase.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Right Column: Top Clients + Low Stock Prizes + Export */}
        <div className="space-y-6">
          {/* Top 5 Clients */}
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Top 5 Clientes</h2>
              </div>
              <button
                onClick={() => navigate('/clients')}
                className="text-sm text-primary-600 hover:underline"
              >
                Ver más
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {stats?.topClients.slice(0, 5).map((client, index) => (
                <div key={client.dni} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                      index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-gray-200 text-gray-700' :
                      index === 2 ? 'bg-amber-200 text-amber-800' :
                      'bg-gray-100 text-gray-700'
                    )}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 truncate">{client.name}</p>
                      <p className="text-xs text-gray-500">DNI: {client.dni}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary-600">{formatNumber(client.currentPoints)} pts</p>
                    <p className="text-xs text-gray-500">saldo actual</p>
                  </div>
                </div>
              ))}
              {(!stats?.topClients || stats.topClients.length === 0) && (
                <div className="p-4 text-center text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No hay clientes registrados</p>
                </div>
              )}
            </div>
          </div>
          
          
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-700 font-medium">Clientes Nuevos</p>
                  <p className="text-2xl font-bold text-blue-900">{stats?.users.newThisMonth || 0}</p>
                  <p className="text-xs text-blue-600">este mes</p>
                </div>
                <div className="p-2 bg-blue-500 rounded-full text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-700 font-medium">Ventas Totales</p>
                  <p className="text-2xl font-bold text-green-900">{formatNumber(stats?.sales.totalPurchases || stats?.sales.totalTransactions || 0)}</p>
                  <p className="text-xs text-green-600">histórico</p>
                </div>
                <div className="p-2 bg-green-500 rounded-full text-white">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>
            </div>
            {/* Export Buttons - added as third element in grid */}
            {selectedBranch && !loading && stats && (
              <div key="export" className="card p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-700 font-medium">Exportar</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExport()}
                      className="bg-purple-500 text-white text-sm px-3 py-1.5 rounded hover:bg-purple-600 transition-colors"
                      disabled={exporting}
                    >
                      {exporting ? 'Generando...' : 'CSV'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}