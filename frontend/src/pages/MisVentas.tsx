import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { cn, formatCurrency, formatDateTime } from '../lib/utils';
import {
  Search, Loader2, Receipt, Clock, CheckCircle2, XCircle, HelpCircle,
  X, RefreshCw, ChevronLeft, ChevronRight, Send,
} from 'lucide-react';

interface MySaleItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

interface MySale {
  id: string;
  receiptNumber: string;
  total: number;
  pointsEarned: number;
  status: string;
  createdAt: string;
  client: { id: string; firstName: string; lastName: string; dni: string };
  branch: { id: string; name: string; code: string };
  itemCount: number;
  items: MySaleItem[];
  canRequestRevision: boolean;
  revision: {
    id: string;
    status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
    observation: string;
    adminResponse: string | null;
    reviewedByName: string | null;
    reviewedAt: string | null;
    createdAt: string;
  } | null;
}

const RevisionBadge = ({ revision, onClick }: { revision: MySale['revision']; onClick: () => void }) => {
  if (!revision) return null;
  const config = {
    PENDIENTE: { icon: Clock, classes: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Revisión pendiente' },
    APROBADA: { icon: CheckCircle2, classes: 'bg-green-100 text-green-800 border-green-200', label: 'Revisión aprobada' },
    RECHAZADA: { icon: XCircle, classes: 'bg-red-100 text-red-800 border-red-200', label: 'Revisión rechazada' },
  }[revision.status];
  const Icon = config.icon;
  return (
    <button
      onClick={onClick}
      title="Ver detalle de la revisión"
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', config.classes)}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </button>
  );
};

export default function MisVentas() {
  const [sales, setSales] = useState<MySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal de revisión (solicita sólo el monto correcto y el motivo)
  const [revisionSale, setRevisionSale] = useState<MySale | null>(null);
  const [detailRevision, setDetailRevision] = useState<MySale['revision']>(null);
  const [newTotal, setNewTotal] = useState('');
  const [observation, setObservation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadSales = useCallback(async (p = page, dni = appliedSearch) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (dni) params.set('dni', dni);
      const res = await api.get<{ purchases: MySale[]; pagination: { page: number; pages: number; total: number } }>(
        `/purchases/mine?${params.toString()}`
      );
      setSales(res.data.purchases);
      setPages(res.data.pagination.pages || 1);
      setTotal(res.data.pagination.total);
      setPage(res.data.pagination.page);
    } catch (err) {
      console.error('Error cargando mis ventas:', err);
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch]);

  useEffect(() => {
    loadSales(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
    loadSales(1, search.trim());
  };

  const openRevisionModal = (sale: MySale) => {
    setRevisionSale(sale);
    setNewTotal(sale.total.toFixed(2));
    setObservation('');
    setSubmitError('');
  };

  const submitRevision = async () => {
    if (!revisionSale) return;
    setSubmitError('');
    const monto = Number(newTotal);
    if (!Number.isFinite(monto) || monto <= 0) {
      setSubmitError('Indicá el monto correcto de la venta (mayor a 0)');
      return;
    }
    if (observation.trim().length < 5) {
      setSubmitError('Escribí el motivo de la revisión');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ message: string }>(`/purchases/${revisionSale.id}/revision`, {
        newTotal: monto,
        observation: observation.trim(),
      });
      setSuccessMsg(res.data.message || 'Solicitud enviada');
      setRevisionSale(null);
      await loadSales();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            Mis Ventas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Podés solicitar la corrección de cualquier venta: indicás el monto correcto y el motivo, y el administrador la revisa.
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por DNI del cliente"
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Buscar
          </button>
          <button
            type="button"
            onClick={() => { setSearch(''); setAppliedSearch(''); loadSales(1, ''); }}
            title="Limpiar"
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </form>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : sales.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
            {appliedSearch ? `No hay ventas para el DNI ${appliedSearch}` : 'No hay ventas registradas'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Comprobante</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Puntos</th>
                  <th className="px-4 py-3 font-medium">Revisión</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{sale.receiptNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDateTime(sale.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{sale.client.firstName} {sale.client.lastName}</div>
                      <div className="text-xs text-gray-400">DNI {sale.client.dni}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(sale.total)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">+{sale.pointsEarned}</td>
                    <td className="px-4 py-3">
                      {sale.revision ? (
                        <RevisionBadge revision={sale.revision} onClick={() => setDetailRevision(sale.revision)} />
                      ) : sale.canRequestRevision ? (
                        <span className="text-xs text-gray-400">Hoy · se puede revisar</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {sale.revision ? (
                        <button
                          onClick={() => setDetailRevision(sale.revision)}
                          title="Ver detalle de la revisión"
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                        >
                          <HelpCircle className="w-5 h-5" />
                        </button>
                      ) : sale.canRequestRevision ? (
                        <button
                          onClick={() => openRevisionModal(sale)}
                          title="Solicitar revisión de esta venta"
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                        >
                          <HelpCircle className="w-5 h-5" />
                        </button>
                      ) : (
                        <span className="block w-9" title="Sólo las ventas del día de hoy pueden revisarse" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{total} ventas</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadSales(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Página {page} de {pages}</span>
              <button
                onClick={() => loadSales(page + 1)}
                disabled={page >= pages}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: detalle de una revisión existente */}
      {detailRevision && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailRevision(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {detailRevision.status === 'PENDIENTE' && <><Clock className="w-5 h-5 text-amber-500" /> Revisión pendiente</>}
                {detailRevision.status === 'APROBADA' && <><CheckCircle2 className="w-5 h-5 text-green-600" /> Revisión aprobada</>}
                {detailRevision.status === 'RECHAZADA' && <><XCircle className="w-5 h-5 text-red-600" /> Revisión rechazada</>}
              </h3>
              <button onClick={() => setDetailRevision(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Tu motivo</p>
                <p className="bg-gray-50 rounded-lg p-3 text-gray-700">{detailRevision.observation}</p>
              </div>
              {detailRevision.status !== 'PENDIENTE' && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                    Respuesta del administrador {detailRevision.reviewedByName ? `(${detailRevision.reviewedByName})` : ''}
                  </p>
                  <p className={cn(
                    'rounded-lg p-3',
                    detailRevision.status === 'RECHAZADA' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
                  )}>
                    {detailRevision.adminResponse || (detailRevision.status === 'APROBADA' ? 'Los cambios fueron aplicados a la venta.' : '—')}
                  </p>
                </div>
              )}
              {detailRevision.status === 'PENDIENTE' && (
                <p className="text-gray-500 text-xs">El administrador va a revisar tu solicitud y te va a responder acá.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: solicitar revisión */}
      {revisionSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-6 pb-0">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  Solicitar revisión de venta
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {revisionSale.receiptNumber} · {revisionSale.client.firstName} {revisionSale.client.lastName} (DNI {revisionSale.client.dni}) · {formatCurrency(revisionSale.total)}
                </p>
              </div>
              <button onClick={() => setRevisionSale(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Monto a actualizar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Monto a actualizar (total final con IVA) <span className="text-red-500">*</span>
                </label>
                <input
                  value={newTotal}
                  onChange={(e) => setNewTotal(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Los productos se ajustan proporcionalmente y los puntos se recalculan al aprobar. El administrador puede corregir el monto antes de aplicarlo.
                </p>
              </div>

              {/* Observación para el admin */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1.5">
                  ¿Por qué pedís la revisión? <span className="text-red-500">*</span>
                </p>
                <textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  rows={3}
                  placeholder="Ej: me equivoqué en la cantidad del producto X, eran 2 y no 3. El cliente se retiró antes de que note el error."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">El administrador va a leer esto para decidir si aprueba los cambios.</p>
              </div>

              {submitError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{submitError}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setRevisionSale(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitRevision}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar al administrador
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
