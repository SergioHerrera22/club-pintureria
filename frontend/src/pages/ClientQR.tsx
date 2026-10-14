import { useState, useEffect } from 'react';
import ClientHeader from '../components/ClientHeader';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { QrCode, Download, RefreshCw, Share2, User, Award, Shield, Info, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface QRData {
  qr: {
    id: string;
    token: string;
    url: string;
    svg: string;
    expiresAt: string | null;
    createdAt: string;
  };
  client: {
    firstName: string;
    lastName: string;
    dni: string;
  };
}

export default function ClientQR() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchQR();
  }, [isAuthenticated]);

  const fetchQR = async () => {
    setLoading(true);
    try {
      const response = await api.get('/client/qr');
      setQrData(response.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error al cargar QR');
      }
    } finally {
      setLoading(false);
    }
  };

  const regenerateQR = async () => {
    setRegenerating(true);
    try {
      const response = await api.post('/client/qr/regenerate');
      setQrData(response.data);
      setCopied(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al regenerar QR');
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!qrData) return;
    try {
      await navigator.clipboard.writeText(qrData.qr.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = qrData!.qr.url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadQR = () => {
    if (!qrData) return;
    // Create a link to download the SVG
    const svgData = qrData.qr.svg;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-club-pintureria-${qrData.client.dni}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto p-6 text-center">
          <div className="animate-pulse">
            <div className="w-48 h-48 mx-auto mb-4 bg-gray-200 rounded-xl" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto" />
          </div>
        </div>
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

  if (!qrData) return null;

  return (
    <div className="min-h-screen bg-gray-50">
            <ClientHeader title="Mi QR" subtitle="Identificación en caja" backTo="/app/home" maxWidth="md" />

      <main className="max-w-md mx-auto px-4 py-6 pb-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Tu código QR personal</h2>
            <p className="text-gray-500 mt-1">Escanea este código en caja para identificar tu cuenta</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-center">
            <div className="inline-block p-2 bg-white rounded-lg shadow-sm">
              <div dangerouslySetInnerHTML={{ __html: qrData.qr.svg }} />
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <p className="font-medium text-gray-900">{qrData.client.firstName} {qrData.client.lastName}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">DNI</p>
                  <p className="font-medium text-gray-900">{qrData.client.dni}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Token</p>
                  <p className="font-mono text-xs text-gray-600 truncate max-w-[150px]">{qrData.qr.token.slice(0, 16)}...</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={copyToClipboard}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copiado!' : 'Copiar enlace'}
            </button>
            <button 
              onClick={downloadQR}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Descargar
            </button>
          </div>

          <div className="mt-4 flex gap-3">
            <button 
              onClick={regenerateQR}
              disabled={regenerating}
              className="flex-1 btn-outline flex items-center justify-center gap-2"
            >
              {regenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Regenerar QR
                </>
              )}
            </button>
            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Mi QR Robles Club',
                    text: 'Mi código QR para identificarme en caja',
                    url: qrData.qr.url,
                  });
                }
              }}
              className="btn-outline flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Compartir
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">¿Cómo usar tu QR?</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Acércate a la caja en cualquier sucursal</li>
                <li>Muestra este código QR al cajero</li>
                <li>El sistema identificará tu cuenta automáticamente</li>
                <li>Tus puntos se acreditarán al instante</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}