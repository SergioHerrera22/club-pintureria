import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { cn, formatNumber } from '../lib/utils';
import {
  MessageCircle, Send, Users, Loader2, Search, CheckCircle2, AlertCircle,
  FileText, Save, Smartphone, X, RefreshCw,
} from 'lucide-react';

interface CampaignRecipient {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone: string | null;
  currentPoints: number;
}

interface RecipientsResponse {
  recipients: CampaignRecipient[];
  total: number;
  withPhone: number;
  withoutPhone: number;
}

interface CampaignResult {
  total: number;
  sent: number;
  failed: number;
  skippedNoPhone: number;
  isTest: boolean;
  errors: Array<{ recipient: string; error: string }>;
}

const TEMPLATE_LABELS: Record<string, string> = {
  points_earned: 'Puntos ganados',
  welcome: 'Bienvenida',
  redemption: 'Canje de premio',
  points_expiring: 'Puntos por vencer',
  campaign_default: 'Campaña (por defecto)',
};

const VARIABLES = ['{nombre}', '{apellido}', '{dni}', '{puntos}', '{total}', '{empresa}'];

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
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [error, setError] = useState('');

  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const res = await api.get<RecipientsResponse>('/campaigns/recipients');
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

  useEffect(() => {
    fetchRecipients();
    fetchTemplates();
  }, []);

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

  const handleSend = async () => {
    setError('');
    setResult(null);

    if (!message.trim()) {
      setError('Escribí el mensaje que querés enviar');
      return;
    }
    if (mode === 'selected' && selectedIds.length === 0) {
      setError('Seleccioná al menos un cliente');
      return;
    }

    const isTest = testPhone.trim().length > 0;
    if (!isTest && !confirm(`¿Enviar este mensaje a ${mode === 'all' ? 'TODOS los clientes con WhatsApp' : `${selectedIds.length} cliente(s)`}?`)) {
      return;
    }

    setSending(true);
    try {
      const res = await api.post<CampaignResult>('/campaigns/send', {
        message,
        sendToAll: !isTest && mode === 'all',
        recipientIds: !isTest && mode === 'selected' ? selectedIds : undefined,
        testPhone: isTest ? testPhone.trim() : undefined,
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar la campaña');
    } finally {
      setSending(false);
    }
  };

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
          <p className="text-gray-500">Editá un mensaje, elegí destinatarios y enviá por WhatsApp</p>
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
                Se reemplazan por los datos de cada cliente al enviar.
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

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('all')}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    mode === 'all' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <p className="font-medium text-gray-900">Todos los clientes</p>
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
                            <p className="text-sm font-medium text-gray-900 truncate">{r.firstName} {r.lastName}</p>
                            <p className="text-xs text-gray-500">DNI {r.dni}{r.phone ? ` · ${r.phone}` : ' · sin teléfono'}</p>
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
                    {testPhone.trim() ? 'Enviar prueba' : 'Enviar WhatsApp'}
                  </>
                )}
              </button>
            </div>

            {result && (
              <div className={cn('card p-4 space-y-2 border', result.failed > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50')}>
                <div className="flex items-center gap-2">
                  {result.failed > 0 ? <AlertCircle className="w-5 h-5 text-amber-600" /> : <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  <p className="font-semibold text-gray-900">
                    {result.isTest ? 'Prueba enviada' : 'Campaña enviada'}
                  </p>
                </div>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>Enviados: <strong>{result.sent}</strong></li>
                  {!result.isTest && <li>Sin teléfono (omitidos): <strong>{result.skippedNoPhone}</strong></li>}
                  {result.failed > 0 && <li>Fallidos: <strong>{result.failed}</strong></li>}
                </ul>
                {result.errors.length > 0 && (
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer">Ver errores ({result.errors.length})</summary>
                    <ul className="mt-1 space-y-0.5">
                      {result.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>{e.recipient}: {e.error}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Templates tab */
        <div className="space-y-4">
          <div className="card p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Plantillas de mensajes</h2>
                <p className="text-sm text-gray-500">Personalizá los mensajes automáticos. Variables: {VARIABLES.join(', ')}</p>
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
    </div>
  );
}
