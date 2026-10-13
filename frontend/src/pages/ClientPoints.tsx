import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn, formatNumber, formatCurrency, formatDateTime } from '../lib/utils';
import { Search, Award, Loader2, History, ChevronDown, ChevronUp, Home, Gift, ArrowRight, CheckCircle } from 'lucide-react';
import { ClientPointsData } from '../types';

interface Transaction {
  id: string;
  type: string;
  total: number;
  pointsEarned: number;
  pointsBalance: number;
  description?: string;
  createdAt: string;
  items?: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

interface Prize {
  id: string;
  code: string;
  name: string;
  description?: string;
  imageUrl?: string;
  pointsCost: number;
  stock: number;
  category: string;
  canAfford: boolean;
}

const typeLabels: Record<string, string> = {
  COMPRA: 'Compra',
  CANJE: 'Canje',
  AJUSTE_MANUAL: 'Ajuste',
  BONIFICACION: 'Bonificación',
  VENCIMIENTO: 'Vencimiento',
};

const typeColors: Record<string, string> = {
  COMPRA: 'bg-green-100 text-green-700',
  CANJE: 'bg-amber-100 text-amber-700',
  AJUSTE_MANUAL: 'bg-blue-100 text-blue-700',
  BONIFICACION: 'bg-purple-100 text-purple-700',
  VENCIMIENTO: 'bg-red-100 text-red-700',
};

export default function ClientPoints() {
  const { dni } = useParams<{ dni: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientPointsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [prizesLoading, setPrizesLoading] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState<string | null>(null);
  const [searchDni, setSearchDni] = useState(dni || '');
  const [error, setError] = useState('');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'points' | 'prizes'>('points');
  const [redeemSuccess, setRedeemSuccess] = useState<{ prizeName: string; pointsSpent: number; newBalance: number } | null>(null);
  
  // Ref para trackear imágenes cargadas sin causar re-renders
  const loadedImagesRef = useRef<Set<string>>(new Set());
  const errorImagesRef = useRef<Set<string>>(new Set());
  
  const resetImageTracking = () => {
    loadedImagesRef.current.clear();
    errorImagesRef.current.clear();
  };
  
  const handleImageLoad = (prizeId: string) => {
    loadedImagesRef.current.add(prizeId);
  };
  
  const handleImageError = (prizeId: string) => {
    errorImagesRef.current.add(prizeId);
    loadedImagesRef.current.delete(prizeId);
  };
  
  const isImageLoaded = (prizeId: string) => loadedImagesRef.current.has(prizeId);
  const isImageError = (prizeId: string) => errorImagesRef.current.has(prizeId);
  
  const fetchClient = async (dniValue: string) => {
    setSearchLoading(true);
    setError('');
    setClient(null);
    setTransactions([]);
    
    try {
      const res = await api.get<ClientPointsData>(`/clients/dni/${dniValue}/points`);
      setClient(res.data);
      
      const historyRes = await api.get<{ transactions: Transaction[] }>(`/clients/dni/${dniValue}/history?limit=50`);
      setTransactions(historyRes.data.transactions);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Cliente no encontrado');
    } finally {
      setSearchLoading(false);
      setLoading(false);
    }
  };
  
  const fetchPrizes = async (dniValue: string) => {
    setPrizesLoading(true);
    try {
      const res = await api.get<{ prizes: Prize[]; currentPoints: number }>(`/prizes/available/${dniValue}`);
      setPrizes(res.data.prizes);
      resetImageTracking(); // Reset tracking on new prizes
      if (client) {
        setClient({ ...client, currentPoints: res.data.currentPoints });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar premios');
    } finally {
      setPrizesLoading(false);
    }
  };
  
  useEffect(() => {
    if (dni) {
      fetchClient(dni);
    }
  }, [dni]);
  
  useEffect(() => {
    if (client && activeTab === 'prizes') {
      fetchPrizes(client.dni);
    }
  }, [activeTab, client]);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchDni.trim().length >= 7) {
      navigate(`/points/${searchDni.trim()}`);
    }
  };
  
  const handleRedeem = async (prize: Prize) => {
    if (!client) return;
    
    setRedeemLoading(prize.id);
    setError('');
    
    try {
      const res = await api.post('/prizes/redeem/client', {
        dni: client.dni,
        prizeId: prize.id,
      });
      
      const newBalance = res.data.newBalance;
      const pointsSpent = res.data.prize.pointsCost;
      
      setRedeemSuccess({
        prizeName: res.data.prize.name,
        pointsSpent,
        newBalance,
      });
      
      // Update local state instead of re-fetching (prevents image flicker)
      setClient(prev => prev ? { 
        ...prev, 
        currentPoints: newBalance, 
        totalPointsRedeemed: prev.totalPointsRedeemed + pointsSpent 
      } : null);
      
      // Update prizes locally: decrement stock, update canAfford
      setPrizes(prev => prev.map(p => {
        if (p.id === prize.id) {
          const newStock = p.stock - 1;
          return {
            ...p,
            stock: newStock,
            canAfford: newStock > 0 && p.pointsCost <= newBalance,
          };
        }
        // Update canAfford for other prizes based on new balance
        return {
          ...p,
          canAfford: p.pointsCost <= newBalance && p.stock > 0,
        };
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al canjear premio');
    } finally {
      setRedeemLoading(null);
    }
  };
  
  const closeSuccessModal = () => {
    setRedeemSuccess(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Club Robles</h1>
                <p className="text-sm text-gray-500">Consulta tus puntos</p>
              </div>
            </div>
            <a href="/" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              <Home className="w-4 h-4" />
              Ir al inicio
            </a>
          </div>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {!client && !loading && !searchDni && (
          <div className="card p-8 text-center">
            <Award className="w-16 h-16 mx-auto mb-4 text-primary-200" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Consulta tus Puntos</h2>
            <p className="text-gray-500 mb-6">Ingresa tu DNI para ver tu saldo y historial</p>
            <form onSubmit={handleSearch} className="max-w-md mx-auto flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tu DNI (ej: 20123456)"
                  value={searchDni}
                  onChange={(e) => setSearchDni(e.target.value)}
                  className="input pl-10 text-center text-lg"
                  maxLength={8}
                />
              </div>
              <button type="submit" disabled={searchLoading} className="btn-primary whitespace-nowrap">
                {searchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Consultar'}
              </button>
            </form>
            {error && <p className="mt-4 text-red-600">{error}</p>}
          </div>
        )}
        
        {loading && (
          <div className="card p-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6 mx-auto" />
            <div className="h-16 bg-gray-200 rounded w-1/2 mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-20 bg-gray-200 rounded" />
              <div className="h-20 bg-gray-200 rounded" />
              <div className="h-20 bg-gray-200 rounded" />
            </div>
          </div>
        )}
        
        {client && (
          <div className="space-y-6">
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mt-1">{client.firstName} {client.lastName}</h2>
                    <p className="opacity-70">DNI: {client.dni}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Puntos Disponibles</p>
                  <p className="text-4xl font-bold text-primary-600 mt-1">{formatNumber(client.currentPoints)}</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                    <Award className="w-3 h-3" /> Para canjear
                  </p>
                </div>
                <div className="border-x border-gray-200 text-center">
                  <p className="text-sm text-gray-500">Total Ganados</p>
                  <p className="text-4xl font-bold text-green-600 mt-1">{formatNumber(client.totalPointsEarned)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Canjeados</p>
                  <p className="text-4xl font-bold text-red-600 mt-1">{formatNumber(client.totalPointsRedeemed)}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="p-4 border-b border-gray-200">
                <div className="flex gap-1" role="tablist">
                  <button
                    role="tab"
                    aria-selected={activeTab === 'points'}
                    onClick={() => setActiveTab('points')}
                    className={cn(
                      'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      activeTab === 'points'
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <Award className="w-4 h-4 mr-1 inline" />
                    Mis Puntos
                  </button>
                  <button
                    role="tab"
                    aria-selected={activeTab === 'prizes'}
                    onClick={() => setActiveTab('prizes')}
                    className={cn(
                      'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      activeTab === 'prizes'
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <Gift className="w-4 h-4 mr-1 inline" />
                    Canjear Premios
                  </button>
                </div>
              </div>
              
              {activeTab === 'points' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Historial de Movimientos
                    </h3>
                  </div>
                  
                  {transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay movimientos registrados</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={cn('badge', typeColors[tx.type] || 'bg-gray-100 text-gray-700')}>
                                {typeLabels[tx.type] || tx.type}
                              </span>
                              <div>
                                <p className="font-medium text-gray-900">{formatDateTime(tx.createdAt)}</p>
                                {tx.description && <p className="text-sm text-gray-500">{tx.description}</p>}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn('font-semibold', tx.pointsEarned >= 0 ? 'text-green-600' : 'text-red-600')}>
                                {tx.pointsEarned >= 0 ? '+' : ''}{formatNumber(tx.pointsEarned)} pts
                              </p>
                              <p className="text-sm text-gray-500">Saldo: {formatNumber(tx.pointsBalance)}</p>
                            </div>
                          </div>
                          
                          {tx.items && tx.items.length > 0 && (
                            <button
                              onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                              className="mt-3 flex items-center gap-1 text-sm text-primary-600 hover:underline"
                            >
                              {expandedTx === tx.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              Ver detalle ({tx.items.length} producto{tx.items.length > 1 ? 's' : ''})
                            </button>
                          )}
                          
                          {expandedTx === tx.id && tx.items && (
                            <div className="mt-3 ml-8 border-l-2 border-gray-200 pl-4 space-y-2">
                              {tx.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">{item.productName}</span>
                                  <span className="text-gray-900 font-medium">
                                    {item.quantity} × {formatCurrency(item.unitPrice)} = {formatCurrency(item.lineTotal)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'prizes' && (
                <div className="p-4">
                  {prizesLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-40 bg-gray-200 rounded-lg mb-3" />
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : prizes.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Gift className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-lg font-medium text-gray-900 mb-1">No hay premios disponibles</p>
                      <p className="text-sm">Vuelve a consultar más tarde</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {prizes.map((prize) => (
                        <div key={prize.id} className={cn(
                          'relative border rounded-xl p-4 transition-all hover:shadow-md',
                          prize.canAfford ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-75'
                        )}>
                          {prize.imageUrl && !isImageError(prize.id) && (
                            <div className="relative h-40 mb-3 rounded-lg overflow-hidden bg-gray-100">
                              <img
                                src={prize.imageUrl}
                                alt={prize.name}
                                className={cn('w-full h-full object-cover transition-opacity duration-300', isImageLoaded(prize.id) ? 'opacity-100' : 'opacity-0')}
                                onLoad={() => handleImageLoad(prize.id)}
                                onError={() => handleImageError(prize.id)}
                              />
                              {!isImageLoaded(prize.id) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                  <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                                </div>
                              )}
                            </div>
                          )}
                          {(isImageError(prize.id) || !prize.imageUrl) && (
                            <div className="relative h-40 mb-3 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
                              <Gift className="w-12 h-12 text-primary-300" />
                            </div>
                          )}
                          <span className="absolute top-3 right-3 bg-primary-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                            {formatNumber(prize.pointsCost)} pts
                          </span>
                          
                          <h4 className={cn('font-semibold text-gray-900 mb-1', !prize.canAfford && 'text-gray-400')}>
                            {prize.name}
                          </h4>
                          {prize.description && (
                            <p className="text-sm text-gray-500 mb-2 line-clamp-2">{prize.description}</p>
                          )}
                          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 mb-3">
                            {prize.category}
                          </span>
                          
                          <button
                            onClick={() => handleRedeem(prize)}
                            disabled={!prize.canAfford || redeemLoading === prize.id}
                            className={cn(
                              'w-full py-2 rounded-lg text-sm font-medium transition-colors',
                              prize.canAfford
                                ? 'bg-primary-600 text-white hover:bg-primary-700'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            )}
                          >
                            {redeemLoading === prize.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                            ) : prize.canAfford ? (
                              <span className="flex items-center justify-center gap-1">
                                Canjear <ArrowRight className="w-3 h-3" />
                              </span>
                            ) : (
                              'Puntos insuficientes'
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-center text-sm text-gray-500">
              <p>¿Dudas sobre tus puntos? Contacta a tu sucursal</p>
            </div>
          </div>
        )}
      </main>
      
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
            <button
              onClick={closeSuccessModal}
              className="btn-primary w-full"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}