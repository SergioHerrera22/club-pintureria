import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { cn, formatNumber, formatDateTime } from '../lib/utils';
import { useToast } from '../components/Toast';
import {
  BookUser, Plus, Pencil, Clock, CheckCircle2, XCircle, Loader2, RefreshCw,
  User as UserIcon,
} from 'lucide-react';

interface AccountPainter {
  id: string;
  name: string;
  dni: string;
  currentPoints: number;
  totalPointsEarned: number;
  totalPointsFromSales: number;
}

interface Account {
  id: string;
  active: boolean;
  notes: string | null;
  createdAt: string;
  createdByName: string | null;
  client: {
    id: string;
    name: string;
    dni: string;
    email: string;
    phone: string | null;
    branch?: { name: string; code: string } | null;
    currentPoints: number;
    totalPointsEarned: number;
  };
  painter: AccountPainter | null;
  recentPurchases: Array<{
    id: string;
    receiptNumber: string;
    total: number;
    pointsEarned: number;
    clientPoints: number;
    painterPoints: number;
    status: string;
    createdAt: string;
  }>;
  lastRevision: {
    id: string;
    status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
    observation: string;
    createdAt: string;
    requestedByName: string;
  } | null;
}

interface AccountRevision {
  id: string;
  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  changes: {
    newPainterDni?: string;
    newPainterName?: string;
    active?: boolean;
    notes?: string;
  };
  originalData: {
    painter?: { name: string; dni: string } | null;
    active?: boolean;
    notes?: string | null;
  };
  observation: string;
  adminResponse: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  requestedBy: { name: string; dni: string };
  account: {
    id: string;
    client: { name: string; dni: string };
    painter: { name: string; dni: string } | null;
    active: boolean;
    notes: string | null;
  };
}

const StatusBadge = ({ status }: { status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' }) => {
  const config = {
    PENDIENTE: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendiente' },
    APROBADA: { color: 'bg-green-100 text-green-800', icon: CheckCircle2, label: 'Aprobada' },
    RECHAZADA: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rechazada' },
  }[status];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.color)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

/** Modal genérico de edición de cuenta (admin directo o solicitud para el admin) */
function EditModal({
  account,
  mode,
  onClose,
  onDone,
}: {
  account: Account;
  mode: 'admin' | 'request';
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [newPainterDni, setNewPainterDni] = useState('');
  const [active, setActive] = useState(account.active);
  const [notes, setNotes] = useState(account.notes ?? '');
  const [observation, setObservation] = useState('');
  const [changeActive, setChangeActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const changedPainter = newPainterDni.trim() !== '';
  const changedActive = changeActive && active !== account.active;
  const changedNotes = notes !== (account.notes ?? '');
  const hasChanges = changedPainter || changedActive || changedNotes;

  const submit = async () => {
    setError('');
    if (changedPainter) {
      const digits = newPainterDni.replace(/\D/g, '');
      if (digits.length < 5 || digits.length > 11) {
        setError('DNI del nuevo pintor inválido');
        return;
      }
    }
    if (mode === 'request' && observation.trim().length < 10) {
      setError('Explicá el motivo del cambio (mínimo 10 caracteres)');
      return;
    }
    if (!hasChanges) {
      setError('Indicá al menos un campo a cambiar');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'admin') {
        await api.patch(`/current-accounts/${account.id}`, {
          ...(changedPainter ? { newPainterDni: newPainterDni.trim() } : {}),
          ...(changedActive ? { active } : {}),
          ...(changedNotes ? { notes: notes.trim() } : {}),
        });
        toast('success', 'Cuenta corriente actualizada');
      } else {
        await api.post(`/current-accounts/${account.id}/edit-request`, {
          ...(changedPainter ? { newPainterDni: newPainterDni.trim() } : {}),
          ...(changedActive ? { active } : {}),
          ...(changedNotes ? { notes: notes.trim() } : {}),
          observation: observation.trim(),
        });
        toast('success', 'Solicitud enviada al administrador');
      }
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Pencil className="w-5 h-5 text-primary-600" />
          {mode === 'admin' ? 'Editar cuenta corriente' : 'Solicitar edición al administrador'}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Cuenta corriente de {account.client.name} ({account.client.dni}) — Pintor actual: {account.painter ? `${account.painter.name} (${account.painter.dni})` : 'sin designar'}
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label">DNI del nuevo pintor (opcional)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="DNI del pintor que reemplaza al actual"
              value={newPainterDni}
              onChange={(e) => setNewPainterDni(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">El pintor debe existir como cliente activo del club.</p>
          </div>

          <div>
            <label className="label">Estado de la cuenta</label>
            <select
              value={String(active)}
              onChange={(e) => { setActive(e.target.value === 'true'); setChangeActive(true); }}
              className="input"
            >
              <option value="true">Activa (acumula 70/30 con el pintor)</option>
              <option value="false">Inactiva (deja de acumular)</option>
            </select>
          </div>

          <div>
            <label className="label">Notas (opcional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              placeholder="Notas internas de la cuenta"
            />
          </div>

          {mode === 'request' && (
            <div>
              <label className="label">Motivo del cambio *</label>
              <textarea
                rows={3}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="input"
                placeholder="Indicá qué campo cambia, el nuevo valor y por qué"
              />
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'admin' ? 'Guardar cambios' : 'Enviar solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal de alta de cuenta corriente */
function NewAccountModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [clientDni, setClientDni] = useState('');
  const [painterDni, setPainterDni] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const clientDigits = clientDni.replace(/\D/g, '');
    const painterDigits = painterDni.replace(/\D/g, '');
    if (clientDigits.length < 5 || clientDigits.length > 11) { setError('DNI del cliente inválido'); return; }
    if (painterDigits.length < 5 || painterDigits.length > 11) { setError('DNI del pintor inválido'); return; }
    if (clientDigits === painterDigits) { setError('El cliente y el pintor no pueden ser la misma persona'); return; }
    setLoading(true);
    try {
      await api.post('/current-accounts', {
        clientDni: clientDni.trim(),
        painterDni: painterDni.trim(),
        notes: notes.trim() || undefined,
      });
      toast('success', 'Cuenta corriente creada');
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear la cuenta corriente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary-600" />
          Nueva cuenta corriente
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          En cada compra del cliente, el 70% de los puntos van al cliente y el 30% al pintor designado.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label">DNI del cliente *</label>
            <input
              type="text"
              inputMode="numeric"
              value={clientDni}
              onChange={(e) => setClientDni(e.target.value)}
              className="input"
              placeholder="DNI del cliente con cuenta corriente"
            />
          </div>
          <div>
            <label className="label">DNI del pintor *</label>
            <input
              type="text"
              inputMode="numeric"
              value={painterDni}
              onChange={(e) => setPainterDni(e.target.value)}
              className="input"
              placeholder="DNI del pintor (debe estar registrado como cliente)"
            />
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              placeholder="Notas internas de la cuenta"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear cuenta
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal para aprobar/rechazar una solicitud (admin) */
function ReviewModal({
  revision,
  action,
  onClose,
  onDone,
}: {
  revision: AccountRevision;
  action: 'approve' | 'reject';
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (action === 'reject' && text.trim().length < 5) {
      setError('Indicá el motivo del rechazo (mínimo 5 caracteres)');
      return;
    }
    setLoading(true);
    try {
      if (action === 'approve') {
        await api.post(`/current-accounts/edit-requests/${revision.id}/approve`, { note: text.trim() || undefined });
        toast('success', 'Solicitud aprobada y cambios aplicados');
      } else {
        await api.post(`/current-accounts/edit-requests/${revision.id}/reject`, { reason: text.trim() });
        toast('success', 'Solicitud rechazada');
      }
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900">
          {action === 'approve' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
        </h3>
        <div className="mt-2 text-sm text-gray-600 space-y-1">
          <p>Cuenta corriente de <strong>{revision.account.client.name}</strong> ({revision.account.client.dni})</p>
          <p>Solicitó: <strong>{revision.requestedBy.name}</strong></p>
          <p className="italic text-gray-500">“{revision.observation}”</p>
        </div>
        <div className="mt-4">
          <label className="label">{action === 'approve' ? 'Nota (opcional)' : 'Motivo del rechazo *'}</label>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="input" />
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={submit}
            disabled={loading}
            className="btn flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 text-white"
            style={{ backgroundColor: action === 'approve' ? '#4f46e5' : '#dc2626' }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CurrentAccounts() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<'ACCOUNTS' | 'REQUESTS'>('ACCOUNTS');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [revisions, setRevisions] = useState<AccountRevision[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [editTarget, setEditTarget] = useState<{ account: Account; mode: 'admin' | 'request' } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ revision: AccountRevision; action: 'approve' | 'reject' } | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/current-accounts');
      setAccounts(res.data.accounts);
      setPendingCount(res.data.pendingCount ?? 0);
    } catch (err) {
      console.error('Error cargando cuentas corrientes:', err);
      setError('Error al cargar las cuentas corrientes');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRevisions = useCallback(async (status?: 'PENDIENTE') => {
    setLoading(true);
    const mine = !isAdmin;
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const res = await api.get(`/current-accounts/${mine ? 'edit-requests/mine' : 'edit-requests'}?${params.toString()}`);
      setRevisions(res.data.revisions);
      setPendingCount(res.data.pendingCount ?? 0);
    } catch (err) {
      console.error('Error cargando solicitudes:', err);
      setError('Error al cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (tab === 'ACCOUNTS') load();
    else loadRevisions('PENDIENTE');
  }, [tab, load, loadRevisions]);

  const filteredAccounts = accounts.filter((a) =>
    !search ||
    a.client.name.toLowerCase().includes(search.toLowerCase()) ||
    a.client.dni.includes(search) ||
    (a.painter?.name.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    (a.painter?.dni.includes(search) ?? false)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookUser className="w-7 h-7 text-primary-600" />
            Cuentas Corrientes
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            En cada venta del cliente con cuenta corriente, el 70% de los puntos son del cliente y el 30% del pintor designado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewAccount(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nueva cuenta corriente
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('ACCOUNTS')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'ACCOUNTS' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Cuentas
        </button>
        <button
          onClick={() => setTab('REQUESTS')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
            tab === 'REQUESTS' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          {isAdmin ? 'Solicitudes de cambio' : 'Mis solicitudes'}
          {pendingCount > 0 && (
            <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded-full">{pendingCount}</span>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-100 text-red-700 rounded-lg px-4 py-3 text-sm">
          <span>{error}</span>
          <button onClick={tab === 'ACCOUNTS' ? load : () => loadRevisions()} className="flex items-center gap-1 hover:underline">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      )}

      {tab === 'ACCOUNTS' ? (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o DNI (cliente o pintor)…"
                className="input pl-9"
              />
            </div>
            <button onClick={load} className="btn-secondary flex items-center gap-2" title="Refrescar">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <BookUser className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium">Sin cuentas corrientes</p>
              <p className="text-sm mt-1">Creá la primera cuenta corriente con el botón “Nueva cuenta corriente”.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAccounts.map((a) => (
                <div key={a.id} className={cn('bg-white border rounded-xl p-4 shadow-sm space-y-3', a.active ? 'border-gray-200' : 'border-gray-200 opacity-70')}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{a.client.name}</p>
                      <p className="text-xs text-gray-500">DNI {a.client.dni} · Cuenta corriente</p>
                    </div>
                    <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-xs font-medium', a.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>
                      {a.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-primary-50 rounded-lg p-3">
                      <p className="text-xs text-primary-700 font-medium flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5" /> Cliente
                      </p>
                      <p className="text-xl font-bold text-primary-900">{formatNumber(a.client.currentPoints)}</p>
                      <p className="text-xs text-primary-600">puntos (70% por venta)</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-xs text-purple-700 font-medium flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5" /> Pintor
                      </p>
                      {a.painter ? (
                        <>
                          <p className="text-xl font-bold text-purple-900">{formatNumber(a.painter.currentPoints)}</p>
                          <p className="text-xs text-purple-600">puntos (30% por venta)</p>
                        </>
                      ) : (
                        <p className="text-sm text-purple-600 mt-2">Sin pintor designado</p>
                      )}
                    </div>
                  </div>

                  {a.painter && (
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">{a.painter.name}</p>
                      <p className="text-xs text-gray-500">DNI {a.painter.dni} · {formatNumber(a.painter.totalPointsFromSales)} pts ganados en ventas</p>
                    </div>
                  )}

                  {a.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5">{a.notes}</p>}

                  {a.recentPurchases.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Ventas recientes</p>
                      <div className="space-y-1">
                        {a.recentPurchases.slice(0, 3).map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                            <span className="text-gray-600">{p.receiptNumber}</span>
                            <span>
                              <span className="text-primary-700 font-medium">Cliente {formatNumber(p.clientPoints)}</span>
                              {' + '}
                              <span className="text-purple-700 font-medium">Pintor {formatNumber(p.painterPoints)}</span>
                              {' pts'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {a.lastRevision?.status === 'PENDIENTE' && (
                    <div className="flex items-center gap-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-100 rounded-lg px-2.5 py-2">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Solicitud pendiente de {a.lastRevision.requestedByName}: “{a.lastRevision.observation}”
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditTarget({ account: a, mode: isAdmin ? 'admin' : 'request' })}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {isAdmin ? 'Editar cuenta' : 'Solicitar edición al admin'}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={async () => {
                          try {
                            await api.patch(`/current-accounts/${a.id}`, { active: !a.active });
                            toast('success', a.active ? 'Cuenta desactivada' : 'Cuenta reactivada');
                            load();
                          } catch {
                            toast('error', 'No se pudo actualizar el estado');
                          }
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                      >
                        {a.active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {!isAdmin ? (
              <p className="text-sm text-gray-500">
                Tus cambios se envían al administrador para revisión. Te avisamos cuando los revisa.
              </p>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => loadRevisions('PENDIENTE')} className="btn-secondary flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4" /> Solo pendientes
                </button>
                <button onClick={() => loadRevisions()} className="btn-secondary flex items-center gap-2 text-sm">
                  <RefreshCw className="w-4 h-4" /> Mostrar todas
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium">No hay solicitudes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {revisions.map((r) => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={r.status} />
                        <span className="text-sm font-medium text-gray-900">
                          Cuenta corriente de {r.account.client.name} ({r.account.client.dni})
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Solicitada por {r.requestedBy.name} · {formatDateTime(r.createdAt)}
                        {r.reviewedAt && ` · Revisada por ${r.reviewedByName} el ${formatDateTime(r.reviewedAt)}`}
                      </p>
                    </div>
                    {r.status === 'PENDIENTE' && isAdmin && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => setReviewTarget({ revision: r, action: 'approve' })} className="btn-primary text-xs">
                          Aprobar
                        </button>
                        <button onClick={() => setReviewTarget({ revision: r, action: 'reject' })} className="text-xs px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Campos a cambiar → nuevos valores</p>
                      <ul className="space-y-1 text-gray-700">
                        {r.changes.newPainterDni && (
                          <li>
                            Pintor: <span className="text-gray-400 line-through">{r.originalData.painter?.name ?? '—'}</span> → <span className="font-medium">{r.changes.newPainterName ?? r.changes.newPainterDni}</span>
                          </li>
                        )}
                        {typeof r.changes.active === 'boolean' && (
                          <li>
                            Estado: <span className="text-gray-400 line-through">{r.originalData.active ? 'Activa' : 'Inactiva'}</span> → <span className="font-medium">{r.changes.active ? 'Activa' : 'Inactiva'}</span>
                          </li>
                        )}
                        {typeof r.changes.notes === 'string' && (
                          <li>
                            Notas: <span className="text-gray-400 line-through">{r.originalData.notes || '—'}</span> → <span className="font-medium">{r.changes.notes || '—'}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Motivo</p>
                      <p className="text-gray-700 italic">“{r.observation}”</p>
                    </div>
                  </div>

                  {r.adminResponse && (
                    <p className={cn(
                      'mt-2 text-xs rounded-lg px-3 py-2',
                      r.status === 'APROBADA' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
                    )}>
                      Respuesta del administrador: {r.adminResponse}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showNewAccount && (
        <NewAccountModal
          onClose={() => setShowNewAccount(false)}
          onDone={() => { setShowNewAccount(false); load(); }}
        />
      )}

      {editTarget && (
        <EditModal
          account={editTarget.account}
          mode={editTarget.mode}
          onClose={() => setEditTarget(null)}
          onDone={() => { setEditTarget(null); tab === 'ACCOUNTS' ? load() : loadRevisions(); }}
        />
      )}

      {reviewTarget && (
        <ReviewModal
          revision={reviewTarget.revision}
          action={reviewTarget.action}
          onClose={() => setReviewTarget(null)}
          onDone={() => { setReviewTarget(null); loadRevisions(); }}
        />
      )}
    </div>
  );
}
