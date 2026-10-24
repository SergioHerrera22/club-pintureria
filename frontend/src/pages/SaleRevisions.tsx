import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { cn, formatCurrency, formatDateTime } from '../lib/utils';
import {
  ClipboardCheck, Clock, CheckCircle2, XCircle, Loader2, RefreshCw,
  ChevronLeft, ChevronRight, ArrowRight, User as UserIcon,
} from 'lucide-react';

interface RevisionItem {
  productId: string;
  productName?: string;
  productCode?: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  lineTotal?: number;
}

interface RevisionChanges {
  items?: RevisionItem[];
  newClientId?: string;
  newClientName?: string;
  notes?: string;
  /** Nuevo total pedido por la cajera (flujo: sólo monto + motivo) */
  newTotal?: number;
}

interface RevisionOriginal {
  clientDni?: string;
  clientName?: string;
  notes?: string | null;
  items?: RevisionItem[];
  total?: number;
  pointsEarned?: number;
}

interface RevisionPreview {
  total?: number;
  pointsEarned?: number;
  pointsDelta?: number;
}

interface SaleRevision {
  id: string;
  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  observation: string;
  changes: RevisionChanges;
  originalData: RevisionOriginal;
  preview: RevisionPreview | null;
  adminResponse: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  requestedBy: { name: string; dni: string };
  purchase: {
    id: string;
    receiptNumber: string;
    total: number;
    pointsEarned: number;
    createdAt: string;
    status: string;
    client: { name: string; dni: string };
    branch: { name: string; code: string };
  };
}

type Tab = 'PENDIENTE' | 'HISTORIAL';

function ItemsComparison({ original, proposed }: { original: RevisionItem[]; proposed: RevisionItem[] }) {
  const originalMap = new Map(original.map(i => [i.productId, i]));
  const proposedMap = new Map(proposed.map(i => [i.productId, i]));
  const allIds = Array.from(new Set([...original.map(i => i.productId), ...proposed.map(i => i.productId)]));

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden text-xs">
      <div className="grid grid-cols-[1fr_70px_70px] bg-gray-50 text-gray-500 font-medium px-3 py-1.5">
        <span>Producto</span>
        <span className="text-center">Antes</span>
        <span className="text-center">Propuesto</span>
      </div>
      {allIds.map(id => {
        const o = originalMap.get(id);
        const p = proposedMap.get(id);
        const name = p?.productName ?? o?.productName ?? 'Producto';
        const changed = (o?.quantity ?? 0) !== (p?.quantity ?? 0);
        return (
          <div key={id} className="grid grid-cols-[1fr_70px_70px] px-3 py-1.5 border-t border-gray-100 items-center">
            <span className="truncate text-gray-700">
              {name}
              {!p && <span className="ml-1 text-red-500">(se quita)</span>}
              {!o && <span className="ml-1 text-green-600">(nuevo)</span>}
            </span>
            <span className={cn('text-center', changed && 'text-gray-400 line-through')}>{o?.quantity ?? '—'}</span>
            <span className={cn('text-center font-medium', changed && 'text-blue-700')}>{p?.quantity ?? '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function SaleRevisions() {
  const [tab, setTab] = useState<Tab>('PENDIENTE');
  const [revisions, setRevisions] = useState<SaleRevision[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SaleRevision | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [approveAmounts, setApproveAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async (p = page, t: Tab = tab) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (t === 'PENDIENTE') params.set('status', 'PENDIENTE');
      const res = await api.get<{ revisions: SaleRevision[]; pendingCount: number; pagination: { page: number; pages: number; total: number } }>(
        `/purchases/revisions?${params.toString()}`
      );
      setRevisions(res.data.revisions);
      setPendingCount(res.data.pendingCount);
      setPages(res.data.pagination.pages || 1);
      setTotal(res.data.pagination.total);
      setPage(res.data.pagination.page);
    } catch (err) {
      console.error('Error cargando revisiones:', err);
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    load(1, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = async (revision: SaleRevision) => {
    setActionLoading(revision.id);
    setError('');
    // En el flujo nuevo la cajera pide sólo el monto; el admin puede corregirlo acá.
    let newTotal: number | undefined;
    if (revision.changes.newTotal != null) {
      const raw = (approveAmounts[revision.id] ?? String(revision.preview?.total ?? revision.changes.newTotal)).replace(',', '.');
      const val = Number(raw);
      if (!Number.isFinite(val) || val <= 0) {
        setError('El monto a aplicar debe ser mayor a 0');
        setActionLoading(null);
        return;
      }
      newTotal = val;
    }
    try {
      await api.post(`/purchases/revisions/${revision.id}/approve`, {
        note: approveNote.trim() || undefined,
        newTotal,
      });
      setApproveNote('');
      setApproveAmounts(prev => {
        const next = { ...prev };
        delete next[revision.id];
        return next;
      });
      await load(page, tab);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al aprobar la revisión');
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    setError('');
    try {
      await api.post(`/purchases/revisions/${rejectTarget.id}/reject`, { reason: rejectReason.trim() });
      setRejectTarget(null);
      setRejectReason('');
      await load(page, tab);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al rechazar la revisión');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6" />
            Revisiones de Ventas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Solicitudes de corrección del personal. Al aprobar, los cambios se aplican y los puntos se ajustan solos.
          </p>
        </div>
        <button onClick={() => load(page, tab)} className="px-3 py-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 self-start">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => { setTab('PENDIENTE'); load(1, 'PENDIENTE'); }}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
            tab === 'PENDIENTE' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
          )}
        >
          <Clock className="w-4 h-4" />
          Pendientes
          {pendingCount > 0 && (
            <span className={cn(
              'px-1.5 py-0.5 rounded-full text-xs font-semibold',
              tab === 'PENDIENTE' ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-800'
            )}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('HISTORIAL'); load(1, 'HISTORIAL'); }}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium',
            tab === 'HISTORIAL' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
          )}
        >
          Historial
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 flex justify-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : revisions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          {tab === 'PENDIENTE' ? 'No hay solicitudes pendientes' : 'Todavía no hay solicitudes revisadas'}
        </div>
      ) : (
        <div className="space-y-4">
          {revisions.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Encabezado */}
              <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-gray-800">{r.purchase.receiptNumber}</span>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium border',
                        r.status === 'PENDIENTE' && 'bg-amber-100 text-amber-800 border-amber-200',
                        r.status === 'APROBADA' && 'bg-green-100 text-green-800 border-green-200',
                        r.status === 'RECHAZADA' && 'bg-red-100 text-red-800 border-red-200'
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDateTime(r.purchase.createdAt)} · {r.purchase.branch.name} · {formatCurrency(r.purchase.total)} · +{r.purchase.pointsEarned} pts
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                    Cliente: <strong>{r.purchase.client.name}</strong> (DNI {r.purchase.client.dni})
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-500">Solicitó:</p>
                  <p className="font-medium text-gray-800">{r.requestedBy.name}</p>
                  <p className="text-xs text-gray-400">DNI {r.requestedBy.dni} · {formatDateTime(r.createdAt)}</p>
                </div>
              </div>

              {/* Observación del vendedor */}
              <div className="px-5 py-3 bg-blue-50/60 border-b border-gray-100">
                <p className="text-xs uppercase tracking-wide text-blue-700 font-medium mb-1">Motivo del solicitante</p>
                <p className="text-sm text-gray-700 italic">“{r.observation}”</p>
              </div>

              {/* Cambios propuestos */}
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Cambios propuestos</p>
                {r.changes.newTotal != null ? (
                  <div className="border border-blue-100 bg-blue-50/50 rounded-lg px-3 py-2.5 text-sm">
                    <span className="text-gray-600">Monto solicitado: </span>
                    <strong className="text-gray-900">{formatCurrency(r.changes.newTotal)}</strong>
                    <span className="text-xs text-gray-500 ml-2">
                      (antes: {formatCurrency(r.originalData.total ?? r.purchase.total)}) · la venta mantiene sus productos; abajo podés aplicar otro monto si el pedido no es exacto
                    </span>
                  </div>
                ) : (
                  <ItemsComparison
                    original={r.originalData.items ?? []}
                    proposed={r.changes.items ?? r.originalData.items ?? []}
                  />
                )}
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <span className="text-gray-600">
                    Total: <strong>{formatCurrency(r.originalData.total ?? r.purchase.total)}</strong>
                    {r.preview?.total !== undefined && (
                      <span className="inline-flex items-center gap-1 ml-2 text-blue-700">
                        <ArrowRight className="w-3.5 h-3.5" /> <strong>{formatCurrency(r.preview.total)}</strong>
                      </span>
                    )}
                  </span>
                  <span className="text-gray-600">
                    Puntos: <strong>+{r.originalData.pointsEarned ?? r.purchase.pointsEarned}</strong>
                    {r.preview?.pointsEarned !== undefined && (
                      <span className="inline-flex items-center gap-1 ml-2 text-blue-700">
                        <ArrowRight className="w-3.5 h-3.5" />
                        <strong>+{r.preview.pointsEarned}</strong>
                        <span className={cn('text-xs', (r.preview.pointsDelta ?? 0) >= 0 ? 'text-green-600' : 'text-red-600')}>
                          ({(r.preview.pointsDelta ?? 0) >= 0 ? '+' : ''}{r.preview.pointsDelta})
                        </span>
                      </span>
                    )}
                  </span>
                  {r.changes.newClientName && (
                    <span className="text-gray-600">
                      Cliente: <strong>{r.originalData.clientName}</strong>
                      <span className="inline-flex items-center gap-1 ml-2 text-blue-700">
                        <ArrowRight className="w-3.5 h-3.5" /> <strong>{r.changes.newClientName}</strong>
                      </span>
                    </span>
                  )}
                  {r.changes.notes && (
                    <span className="text-gray-600 w-full">
                      Notas: <strong>{r.changes.notes}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Acciones o resolución */}
              {r.status === 'PENDIENTE' ? (
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
                  {r.changes.newTotal != null && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Monto a aplicar (podés corregirlo antes de aprobar)</label>
                      <input
                        value={approveAmounts[r.id] ?? String(r.preview?.total ?? r.changes.newTotal)}
                        onChange={(e) => setApproveAmounts(prev => ({ ...prev, [r.id]: e.target.value }))}
                        inputMode="decimal"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}
                  <input
                    value={approveNote}
                    onChange={(e) => setApproveNote(e.target.value)}
                    placeholder="Nota opcional para el vendedor al aprobar..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setRejectTarget(r); setRejectReason(''); }}
                      className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> Rechazar
                    </button>
                    <button
                      onClick={() => approve(r)}
                      disabled={actionLoading === r.id}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {actionLoading === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Aprobar y aplicar cambios
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-3 border-t border-gray-100 text-sm">
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                    {r.status === 'APROBADA' ? 'Aprobada' : 'Rechazada'}
                    {r.reviewedByName ? ` por ${r.reviewedByName}` : ''} · {r.reviewedAt ? formatDateTime(r.reviewedAt) : ''}
                  </p>
                  <p className={cn('rounded-lg p-3', r.status === 'RECHAZADA' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800')}>
                    {r.adminResponse || (r.status === 'APROBADA' ? 'Cambios aplicados.' : '—')}
                  </p>
                </div>
              )}
            </div>
          ))}

          {pages > 1 && (
            <div className="flex items-center justify-between px-1 text-sm text-gray-500">
              <span>{total} solicitudes</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => load(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded border border-gray-200 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Página {page} de {pages}</span>
                <button
                  onClick={() => load(page + 1)}
                  disabled={page >= pages}
                  className="p-1.5 rounded border border-gray-200 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de rechazo */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRejectTarget(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <XCircle className="w-5 h-5 text-red-600" /> Rechazar solicitud
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Venta {rejectTarget.purchase.receiptNumber} · {rejectTarget.requestedBy.name}
            </p>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Motivo del rechazo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ej: el ticket físico confirma la cantidad original. Los puntos calculados son correctos."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">Este motivo queda registrado y el vendedor lo ve en "Mis Ventas".</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={reject}
                disabled={actionLoading === rejectTarget.id || rejectReason.trim().length < 5}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading === rejectTarget.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
