import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { cn, formatCurrency, formatDateTime } from '../lib/utils';
import {
  Search, Loader2, Receipt, Clock, CheckCircle2, XCircle, HelpCircle,
  Plus, Minus, Trash2, X, RefreshCw, ChevronLeft, ChevronRight, Send, Package,
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

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  brand?: string | null;
  unitPrice: number;
}

interface DraftItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
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

  // Modal de revisión
  const [revisionSale, setRevisionSale] = useState<MySale | null>(null);
  const [detailRevision, setDetailRevision] = useState<MySale['revision']>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [newClientDni, setNewClientDni] = useState('');
  const [newClientName, setNewClientName] = useState<string | null>(null);
  const [clientChecking, setClientChecking] = useState(false);
  const [clientError, setClientError] = useState('');
  const [notes, setNotes] = useState('');
  const [observation, setObservation] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
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
    setDraftItems(sale.items.map(i => ({
      productId: i.productId,
      productName: i.productName,
      productCode: i.productCode,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
    })));
    setNewClientDni('');
    setNewClientName(null);
    setClientError('');
    setNotes('');
    setObservation('');
    setProductSearch('');
    setProductResults([]);
    setShowProductSearch(false);
    setSubmitError('');
  };

  const searchProducts = async (term: string) => {
    setProductSearch(term);
    if (term.trim().length < 2) {
      setProductResults([]);
      return;
    }
    try {
      const res = await api.get<{ products: Product[] }>(`/products?isActive=true&limit=8&search=${encodeURIComponent(term.trim())}`);
      setProductResults(res.data.products);
    } catch {
      setProductResults([]);
    }
  };

  const addItem = (product: Product) => {
    setDraftItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        quantity: 1,
        unitPrice: Number(product.unitPrice),
        discount: 0,
      }];
    });
    setShowProductSearch(false);
    setProductSearch('');
    setProductResults([]);
  };

  const changeQty = (productId: string, delta: number) => {
    setDraftItems(prev =>
      prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
    );
  };

  const removeItem = (productId: string) => {
    setDraftItems(prev => {
      const next = prev.filter(i => i.productId !== productId);
      return next;
    });
  };

  const checkNewClient = async () => {
    const dni = newClientDni.trim();
    setNewClientName(null);
    setClientError('');
    if (!dni) return;
    setClientChecking(true);
    try {
      const res = await api.get<{ id: string; firstName: string; lastName: string; dni: string }>(`/clients/dni/${dni}`);
      const c = res.data;
      if (c && revisionSale && c.id === revisionSale.client.id) {
        setClientError('Ese ya es el cliente actual de la venta');
      } else if (c) {
        setNewClientName(`${c.firstName} ${c.lastName}`);
      } else {
        setClientError('No se encontró un cliente con ese DNI');
      }
    } catch (err: any) {
      setClientError(err?.response?.data?.error || 'No se encontró un cliente con ese DNI');
    } finally {
      setClientChecking(false);
    }
  };

  const draftSubtotal = draftItems.reduce((s, i) => s + i.unitPrice * i.quantity * (1 - i.discount / 100), 0);
  const draftTotal = Math.round(draftSubtotal * 1.21 * 100) / 100;

  const submitRevision = async () => {
    if (!revisionSale) return;
    setSubmitError('');
    if (observation.trim().length < 10) {
      setSubmitError('Escribí el motivo de la revisión (mínimo 10 caracteres)');
      return;
    }
    if (draftItems.length === 0) {
      setSubmitError('La venta debe tener al menos un producto');
      return;
    }
    if (newClientDni.trim() && !newClientName) {
      setSubmitError('Verificá el DNI del nuevo cliente antes de enviar');
      return;
    }
    const originalKey = JSON.stringify(revisionSale.items.map(i => [i.productId, i.quantity]));
    const draftKey = JSON.stringify(draftItems.map(i => [i.productId, i.quantity]));
    const itemsChanged = originalKey !== draftKey;
    const clientChanged = !!newClientName && newClientDni.trim() !== revisionSale.client.dni;
    const notesChanged = notes.trim() !== '';
    if (!itemsChanged && !clientChanged && !notesChanged) {
      setSubmitError('No hiciste ningún cambio: editá cantidades, productos, cliente o notas');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { observation: observation.trim() };
      if (itemsChanged) {
        payload.items = draftItems.map(i => ({ productId: i.productId, quantity: i.quantity, discount: i.discount || undefined }));
      }
      if (clientChanged) payload.newClientDni = newClientDni.trim();
      if (notesChanged) payload.notes = notes.trim();
      const res = await api.post<{ message: string }>(`/purchases/${revisionSale.id}/revision`, payload);
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
            Las ventas que registraste con tu usuario. Podés solicitar una corrección de las ventas de hoy.
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
            {appliedSearch ? `No hay ventas para el DNI ${appliedSearch}` : 'Todavía no registraste ventas'}
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
              {/* Items editables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Productos de la venta</p>
                  <button
                    onClick={() => setShowProductSearch(v => !v)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                  >
                    <Package className="w-3.5 h-3.5" /> Agregar producto
                  </button>
                </div>

                {showProductSearch && (
                  <div className="mb-3">
                    <input
                      autoFocus
                      value={productSearch}
                      onChange={(e) => searchProducts(e.target.value)}
                      placeholder="Buscar producto por nombre o código..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {productResults.length > 0 && (
                      <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {productResults.map(p => (
                          <button
                            key={p.id}
                            onClick={() => addItem(p)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between text-sm"
                          >
                            <span>
                              <span className="font-medium text-gray-800">{p.name}</span>
                              <span className="text-xs text-gray-400 ml-2">{p.code}</span>
                            </span>
                            <span className="text-gray-500">{formatCurrency(Number(p.unitPrice))}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {draftItems.map(item => (
                    <div key={item.productId} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-400">{item.productCode} · {formatCurrency(item.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(item.productId, -1)} className="p-1 rounded border border-gray-200 hover:bg-gray-50">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => changeQty(item.productId, 1)} className="p-1 rounded border border-gray-200 hover:bg-gray-50">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="w-24 text-right text-sm text-gray-700">
                        {formatCurrency(item.unitPrice * item.quantity * (1 - item.discount / 100))}
                      </span>
                      <button
                        onClick={() => removeItem(item.productId)}
                        disabled={draftItems.length <= 1}
                        title={draftItems.length <= 1 ? 'La venta debe tener al menos un producto' : 'Quitar'}
                        className="p-1.5 rounded text-red-500 hover:bg-red-50 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm mt-2 px-1">
                  <span className="text-gray-500">Nuevo total estimado (con IVA)</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(draftTotal)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 px-1">Los puntos se recalculan según las reglas vigentes al aprobarse.</p>
              </div>

              {/* Cambiar cliente */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1.5">Cambiar cliente (opcional)</p>
                <div className="flex gap-2">
                  <input
                    value={newClientDni}
                    onChange={(e) => { setNewClientDni(e.target.value.replace(/\D/g, '').slice(0, 8)); setNewClientName(null); setClientError(''); }}
                    placeholder="DNI del cliente correcto"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={checkNewClient}
                    disabled={!newClientDni.trim() || clientChecking}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {clientChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Verificar
                  </button>
                </div>
                {newClientName && (
                  <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Cliente encontrado: {newClientName}
                  </p>
                )}
                {clientError && <p className="text-xs text-red-600 mt-1">{clientError}</p>}
              </div>

              {/* Notas */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1.5">Notas de la venta (opcional)</p>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: pago con transferencia, cliente frecuente..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
