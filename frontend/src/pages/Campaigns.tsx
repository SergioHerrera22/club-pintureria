import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { cn, formatNumber } from '../lib/utils';
import {
  MessageCircle, Send, Users, Loader2, Search, CheckCircle2, AlertCircle,
  FileText, Save, Smartphone, X, RefreshCw, ExternalLink, Copy, SkipForward,
} from 'lucide-react';

interface CampaignRecipient {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone: string | null;
  currentPoints: number;
  branchId: string | null;
  branchName: string | null;
  createdAt: string;
}

interface BranchOption {
  id: string;
  name: string;
}

/** Indica si una fecha corresponde al día de hoy (hora local del navegador). */
const isToday = (date: string | Date): boolean => {
  const d = new Date(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

interface RecipientsResponse {
  recipients: CampaignRecipient[];
  total: number;
  withPhone: number;
  withoutPhone: number;
}

interface PreparedMessage {
  id: string;
  name: string;
  /** Teléfono normalizado para WhatsApp (con código de país, sin +) */
  phone: string;
  /** Mensaje con las variables ya reemplazadas para este destinatario */
  message: string;
}

interface PrepareCampaignResponse {
  isTest: boolean;
  messages: PreparedMessage[];
  skipped: Array<{ name: string; phone: string | null; reason: string }>;
}

interface SendQueue {
  messages: PreparedMessage[];
  skipped: PrepareCampaignResponse['skipped'];
  /** Índice del próximo destinatario a abrir */
  index: number;
  opened: number;
  jumped: number;
  popupBlocked: boolean;
}

const TEMPLATE_LABELS: Record<string, string> = {
  points_earned: 'Puntos ganados',
  welcome: 'Bienvenida',
  redemption: 'Canje de premio',
  points_expiring: 'Puntos por vencer',
  campaign_default: 'Campaña (por defecto)',
};

const VARIABLES = ['{nombre}', '{apellido}', '{dni}', '{puntos}', '{total}', '{empresa}'];

/** Variables que acepta cada plantilla al renderizarse. */
const TEMPLATE_VARIABLES: Record<string, string[]> = {
  points_earned: ['{nombre}', '{puntos}', '{total}', '{monto}', '{ticket}', '{sucursal}', '{fecha}', '{empresa}'],
  welcome: ['{nombre}', '{empresa}'],
  redemption: ['{nombre}', '{premio}', '{puntos}', '{total}', '{empresa}'],
  points_expiring: ['{nombre}', '{puntos}', '{dias}', '{empresa}'],
  campaign_default: VARIABLES,
};

/** Dónde se usa cada plantilla. */
const TEMPLATE_HINTS: Record<string, string> = {
  points_earned: 'Se usa al cargar una compra (se abre en WhatsApp Web de la cajera).',
  welcome: 'Se usa si es la primera compra del cliente o en el alta desde el portal.',
  redemption: 'Al canjear puntos por un premio.',
  points_expiring: 'Aviso automático por puntos por vencer.',
  campaign_default: 'Se usa en Campañas → Enviar cuando no se elige otra plantilla.',
};

export default function Campaigns() {
  const [tab, setTab] = useState<'send' | 'templates'>('send');
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [stats, setStats] = useState({ total: 0, withPhone: 0, withoutPhone: 0 });
  const [loadingRecipients, setLoadingRecipients] = useState(true);

  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [templateMsg, setTemplateMsg] = useState('');

  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [queue, setQueue] = useState<SendQueue | null>(null);
  const [error, setError] = useState('');

  /** Filtro de sucursal: '' = todas las sucursales */
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const fetchRecipients = async (filterBranchId = branchId) => {
    setLoadingRecipients(true);
    try {
      const res = await api.get<RecipientsResponse>('/campaigns/recipients', {
        params: filterBranchId ? { branchId: filterBranchId } : {},
      });
      setRecipients(res.data.recipients);
      setStats({ total: res.data.total, withPhone: res.data.withPhone, withoutPhone: res.data.withoutPhone });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar clientes');
    } finally {
      setLoadingRecipients(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get<{ templates: Record<string, string> }>('/campaigns/templates');
      setTemplates(res.data.templates);
    } catch {
      // ignore
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get<{ branches: BranchOption[] }>('/branches?isActive=true&limit=100');
      setBranches(res.data.branches);
    } catch {
      // ignore: sin sucursales el filtro queda en "todas"
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchBranches();
  }, []);

  // Recarga los destinatarios al cambiar el filtro de sucursal.
  // Se limpia la selección para no mandarle la campaña a clientes de otra sucursal.
  useEffect(() => {
    setSelectedIds([]);
    fetchRecipients(branchId);
  }, [branchId]);

  const selectedBranchName = branchId ? branches.find((b) => b.id === branchId)?.name ?? '' : '';

  const filteredRecipients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        r.dni.includes(q)
    );
  }, [recipients, search]);

  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allFilteredSelected =
    filteredRecipients.length > 0 && filteredRecipients.every((r) => selectedIds.includes(r.id));

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredRecipients.some((r) => r.id === id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredRecipients.map((r) => r.id)])));
    }
  };

  const insertVariable = (v: string) => setMessage((prev) => `${prev}${v}`);

  const loadTemplate = (key: string) => {
    if (templates[key]) setMessage(templates[key]);
  };

  const openWhatsAppTab = (m: PreparedMessage): boolean => {
    const url = `https://web.whatsapp.com/send?phone=${m.phone}&text=${encodeURIComponent(m.message)}&type=phone_number&app_absent=0`;
    const win = window.open(url, '_blank');
    return !!win;
  };

  const handleSend = async () => {
    setError('');

    if (!message.trim()) {
      setError('Escribí el mensaje que querés enviar');
      return;
    }
    if (mode === 'selected' && selectedIds.length === 0) {
      setError('Seleccioná al menos un cliente');
      return;
    }

    const isTest = testPhone.trim().length > 0;
    const branchScope = selectedBranchName ? ` de la sucursal "${selectedBranchName}"` : '';
    if (
      !isTest &&
      !confirm(
        `¿Abrir WhatsApp Web para enviar este mensaje a ${
          mode === 'all'
            ? `TODOS los clientes${branchScope} con WhatsApp (${stats.withPhone})`
            : `${selectedIds.length} cliente(s)`
        }?`
      )
    ) {
      return;
    }

    setSending(true);
    try {
      const res = await api.post<PrepareCampaignResponse>('/campaigns/prepare', {
        message,
        sendToAll: !isTest && mode === 'all',
        recipientIds: !isTest && mode === 'selected' ? selectedIds : undefined,
        testPhone: isTest ? testPhone.trim() : undefined,
        branchId: branchId || undefined,
      });

      if (res.data.messages.length === 0) {
        setError('Ningún destinatario tiene un teléfono de WhatsApp válido');
        return;
      }

      // Se aprovecha el click del usuario para abrir la primera pestaña;
      // si el navegador la bloquea, el panel permite abrirla manualmente.
      const openedFirst = openWhatsAppTab(res.data.messages[0]) ? 1 : 0;

      setQueue({
        messages: res.data.messages,
        skipped: res.data.skipped,
        index: openedFirst,
        opened: openedFirst,
        jumped: 0,
        popupBlocked: openedFirst === 0,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al preparar la campaña');
    } finally {
      setSending(false);
    }
  };

  const currentMessage = queue && queue.index < queue.messages.length ? queue.messages[queue.index] : null;

  const handleOpenCurrent = () => {
    if (!queue || !currentMessage) return;
    const opened = openWhatsAppTab(currentMessage);
    setQueue((prev) =>
      prev
        ? {
            ...prev,
            index: opened ? prev.index + 1 : prev.index,
            opened: opened ? prev.opened + 1 : prev.opened,
            popupBlocked: !opened,
          }
        : prev
    );
  };

  const handleSkipCurrent = () => {
    setQueue((prev) => (prev ? { ...prev, index: prev.index + 1, jumped: prev.jumped + 1, popupBlocked: false } : prev));
  };

  const handleCopyMessage = async () => {
    if (!currentMessage) return;
    try {
      await navigator.clipboard.writeText(currentMessage.message);
    } catch {
      // ignore
    }
  };

  const closeQueue = () => setQueue(null);

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    setTemplateMsg('');
    try {
      await api.put('/system-config/whatsapp_templates', { value: templates });
      setTemplateMsg('Plantillas guardadas correctamente');
    } catch (err: any) {
      setTemplateMsg(err.response?.data?.error || 'Error al guardar las plantillas');
    } finally {
      setSavingTemplates(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas por WhatsApp</h1>
          <p className="text-gray-500">Editá un mensaje, elegí destinatarios y abrí WhatsApp Web para enviarlo</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
          <button
            onClick={() => setTab('send')}
            className={cn('flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2', tab === 'send' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600')}
          >
            <Send className="w-4 h-4" /> Enviar
          </button>
          <button
            onClick={() => setTab('templates')}
            className={cn('flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2', tab === 'templates' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600')}
          >
            <FileText className="w-4 h-4" /> Plantillas
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {tab === 'send' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message editor */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary-600" /> Mensaje
                </h2>
                <select
                  onChange={(e) => { loadTemplate(e.target.value); e.target.value = ''; }}
                  className="input w-auto text-sm py-1.5"
                  defaultValue=""
                >
                  <option value="" disabled>Cargar plantilla...</option>
                  {Object.keys(TEMPLATE_LABELS).map((k) => (
                    <option key={k} value={k}>{TEMPLATE_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={9}
                placeholder="Escribí el mensaje. Usá variables como {nombre} para personalizar."
                className="input font-mono text-sm resize-y min-h-[180px]"
              />

              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2 py-1 text-xs font-mono rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    {v}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-500">
                Se reemplazan por los datos de cada cliente al enviar. {'{puntos}'} son los puntos de la última
                compra y {'{total}'} el saldo acumulado.
              </p>
            </div>

            <div className="card p-4 sm:p-5">
              <label className="label flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Enviar sólo una prueba (opcional)
              </label>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Ej: 1155551234 (dejar vacío para enviar a los destinatarios)"
                className="input"
                inputMode="tel"
              />
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-4">
            <div className="card p-4 sm:p-5 space-y-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" /> Destinatarios
              </h2>

              <div>
                <label className="label" htmlFor="campaign-branch">Filtrar por sucursal</label>
                <select
                  id="campaign-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">Todas las sucursales</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('all')}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    mode === 'all' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <p className="font-medium text-gray-900">
                    Todos los clientes{selectedBranchName ? ` · ${selectedBranchName}` : ''}
                  </p>
                  <p className="text-xs text-gray-500">{stats.withPhone} con WhatsApp · {stats.withoutPhone} sin teléfono</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('selected')}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    mode === 'selected' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <p className="font-medium text-gray-900">Seleccionar clientes</p>
                  <p className="text-xs text-gray-500">{selectedIds.length} seleccionado(s)</p>
                </button>
              </div>

              {mode === 'selected' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nombre o DNI..."
                      className="input pl-9 text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <button type="button" onClick={toggleAllFiltered} className="text-primary-600 font-medium hover:underline">
                      {allFilteredSelected ? 'Quitar todos' : 'Seleccionar todos'}
                    </button>
                    {selectedIds.length > 0 && (
                      <button type="button" onClick={() => setSelectedIds([])} className="text-gray-500 hover:underline flex items-center gap-1">
                        <X className="w-3 h-3" /> Limpiar
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {loadingRecipients ? (
                      <div className="p-4 flex items-center justify-center text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : filteredRecipients.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500 text-center">Sin resultados</p>
                    ) : (
                      filteredRecipients.map((r) => (
                        <label key={r.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(r.id)}
                            onChange={() => toggleRecipient(r.id)}
                            className="rounded border-gray-300"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                              <span className="truncate">{r.firstName} {r.lastName}</span>
                              {isToday(r.createdAt) && (
                                <span
                                  className="inline-flex items-center flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 border border-green-200 rounded-full"
                                  title="Cliente cargado hoy"
                                >
                                  Nuevo
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              DNI {r.dni}{r.phone ? ` · ${r.phone}` : ' · sin teléfono'}
                              {!branchId && r.branchName ? ` · ${r.branchName}` : ''}
                            </p>
                          </div>
                          <span className="text-xs text-primary-600 font-medium">{formatNumber(r.currentPoints)} pts</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <Send className="w-5 h-5" />
                    {testPhone.trim() ? 'Enviar prueba' : 'Enviar por WhatsApp Web'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Plantillas de mensajes</h2>
                <p className="text-sm text-gray-500">Personalizá los mensajes automáticos. Cada plantilla lista sus variables.</p>
              </div>
              <button onClick={handleSaveTemplates} disabled={savingTemplates} className="btn-primary flex items-center gap-2 w-full sm:w-auto">
                {savingTemplates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar plantillas
              </button>
            </div>

            {templateMsg && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">{templateMsg}</div>
            )}

            <div className="space-y-4">
              {Object.keys(TEMPLATE_LABELS).map((key) => (
                <div key={key}>
                  <label className="label">{TEMPLATE_LABELS[key]}</label>
                  <textarea
                    rows={4}
                    value={templates[key] ?? ''}
                    onChange={(e) => setTemplates((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="input font-mono text-sm resize-y"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    {TEMPLATE_HINTS[key] ? `${TEMPLATE_HINTS[key]} ` : ''}
                    Variables: {(TEMPLATE_VARIABLES[key] || VARIABLES).join(' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">¿Necesitás recargar los valores guardados?</p>
            <button onClick={fetchTemplates} className="btn-outline flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Recargar
            </button>
          </div>
        </div>
      )}

      {/* Cola de envío por WhatsApp Web */}
      {queue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Enviar por WhatsApp Web</h2>
                <p className="text-xs text-gray-500">
                  {currentMessage
                    ? `Pendientes: ${queue.messages.length - queue.index} de ${queue.messages.length}`
                    : 'Listo'}
                </p>
              </div>
              <button onClick={closeQueue} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all"
                  style={{ width: `${Math.round((queue.index / queue.messages.length) * 100)}%` }}
                />
              </div>

              {currentMessage ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{currentMessage.name}</p>
                      <p className="text-xs text-gray-500">+{currentMessage.phone}</p>
                    </div>
                    <span className="text-xs font-medium text-gray-500 flex-shrink-0">
                      {queue.index + 1} / {queue.messages.length}
                    </span>
                  </div>

                  {queue.popupBlocked && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      El navegador bloqueó la pestaña. Habilitá las ventanas emergentes para este sitio y volvé a
                      abrir, o usá "Copiar mensaje" y pegalo en WhatsApp Web.
                    </div>
                  )}

                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                    {currentMessage.message}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleOpenCurrent}
                      className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Abrir WhatsApp Web
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="btn-outline py-2.5 px-3 flex items-center justify-center gap-2"
                      title="Copiar mensaje al portapapeles"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipCurrent}
                      className="btn-outline py-2.5 px-3 flex items-center justify-center gap-2"
                    >
                      <SkipForward className="w-4 h-4" /> Saltar
                    </button>
                  </div>

                  <p className="text-xs text-gray-500">
                    Se abre una pestaña de WhatsApp Web con el chat y el mensaje ya escrito. Enviá el mensaje en
                    WhatsApp y volvé acá para pasar al siguiente.
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="font-semibold text-gray-900">Cola finalizada</p>
                  </div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>Pestañas abiertas: <strong>{queue.opened}</strong></li>
                    <li>Saltados: <strong>{queue.jumped}</strong></li>
                    {queue.skipped.length > 0 && (
                      <li>Sin WhatsApp válido: <strong>{queue.skipped.length}</strong></li>
                    )}
                  </ul>
                  {queue.skipped.length > 0 && (
                    <details className="text-xs text-gray-600">
                      <summary className="cursor-pointer">Ver destinatarios omitidos ({queue.skipped.length})</summary>
                      <ul className="mt-1 space-y-0.5">
                        {queue.skipped.slice(0, 20).map((s, i) => (
                          <li key={i}>{s.name}: {s.reason}{s.phone ? ` (${s.phone})` : ''}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <button type="button" onClick={closeQueue} className="btn-primary w-full py-2.5">
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
