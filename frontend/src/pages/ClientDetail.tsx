import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn, formatCurrency, formatNumber, formatDateTime, getTransactionTypeLabel } from '../lib/utils';
import { ArrowLeft, Award, History, ChevronDown, ChevronUp } from 'lucide-react';
import { ClientData, Transaction } from '../types';

interface ClientDetailData extends ClientData {
  transactions: {
    transactions: Transaction[];
    pagination: { page: number; limit: number; total: number; pages: number };
  };
}

export default function ClientDetail() {
  const { dni } = useParams<{ dni: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchClient = async () => {
      if (!dni) return;
      
      try {
        const [clientRes, historyRes] = await Promise.all([
          api.get<ClientData>(`/clients/dni/${dni}`),
          api.get<{ transactions: Transaction[] }>(`/clients/dni/${dni}/history?limit=50`),
        ]);
        
        setClient({
          ...clientRes.data,
          transactions: { transactions: historyRes.data.transactions, pagination: { page: 1, limit: 50, total: historyRes.data.transactions.length, pages: 1 } }
        });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar cliente');
      } finally {
        setLoading(false);
      }
    };
    
    fetchClient();
  }, [dni]);
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card p-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
        </div>
        <div className="card">
          <div className="divide-y divide-gray-200">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !client) {
    return (
      <div className="card p-12 text-center">
        <p className="text-red-600 mb-4">{error || 'Cliente no encontrado'}</p>
        <button onClick={() => navigate('/clients')} className="btn-primary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/clients')} className="btn-outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {client.firstName} {client.lastName}
          </h1>
          <p className="text-gray-500">DNI: {client.dni}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6 bg-primary-50 border-primary-200">
          <p className="text-sm text-primary-600">Puntos Actuales</p>
          <p className="text-3xl font-bold text-primary-700">{formatNumber(client.clientProfile.currentPoints)}</p>
          <p className="text-sm text-primary-500 mt-1">
            <Award className="w-4 h-4 inline mr-1" /> Disponibles para canje
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Total Ganados</p>
          <p className="text-3xl font-bold text-green-600">{formatNumber(client.clientProfile.totalPointsEarned)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Total Canjeados</p>
          <p className="text-3xl font-bold text-red-600">{formatNumber(client.clientProfile.totalPointsRedeemed)}</p>
        </div>
      </div>
      
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Historial de Transacciones</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {client.transactions.transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay transacciones registradas</p>
            </div>
          ) : (
            client.transactions.transactions.map((tx) => (
              <div key={tx.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'badge',
                      tx.type === 'COMPRA' ? 'badge-success' :
                      tx.type === 'CANJE' ? 'badge-warning' :
                      'badge-info'
                    )}>
                      {getTransactionTypeLabel(tx.type)}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{formatDateTime(tx.createdAt)}</p>
                      <p className="text-sm text-gray-500">
                        {tx.type === 'COMPRA' ? `Compra de ${tx.items?.length || 0} productos` : 
                         tx.type === 'CANJE' ? `Canje de premio` :
                         tx.description || 'Ajuste manual'}
                      </p>
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
                    onClick={() => setExpandedTransaction(expandedTransaction === tx.id ? null : tx.id)}
                    className="mt-3 flex items-center gap-1 text-sm text-primary-600 hover:underline"
                  >
                    {expandedTransaction === tx.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Ver {tx.items.length} producto{tx.items.length > 1 ? 's' : ''}
                  </button>
                )}
                
                {expandedTransaction === tx.id && tx.items && (
                  <div className="mt-3 ml-8 border-l-2 border-gray-200 pl-4 space-y-2">
                    {tx.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{item.product.name}</span>
                        <span className="text-gray-900 font-medium">
                          {item.quantity} × {formatCurrency(item.unitPrice)} = {formatCurrency(item.lineTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}