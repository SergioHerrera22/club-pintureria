import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import logoUrl from '../assets/robles-logo.png';
import {
  AlertCircle,
  ArrowLeft,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
  UserPlus,
} from 'lucide-react';

type PortalStep = 'dni' | 'claim' | 'login' | 'register';

interface CheckResponse {
  status: 'NOT_FOUND' | 'NEEDS_PASSWORD' | 'READY';
  firstName?: string;
  verifyBy?: 'phone' | 'email' | 'none';
}

const cleanDni = (raw: string) => raw.replace(/[.\-\s]/g, '');

export default function ClientPortal() {
  const navigate = useNavigate();
  const { clientPortalLogin, clientPortalClaim, clientPortalRegister, isLoading } = useAuthStore();

  const [step, setStep] = useState<PortalStep>('dni');
  const [error, setError] = useState('');
  const [dni, setDni] = useState('');
  const [firstName, setFirstName] = useState('');
  const [verifyBy, setVerifyBy] = useState<'phone' | 'email' | 'none'>('phone');

  // Campos de los distintos pasos
  const [verifyValue, setVerifyValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');

  const handleError = (err: unknown, fallback: string) => {
    const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    setError(message || fallback);
  };

  const handleCheckDni = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleaned = cleanDni(dni);
    if (cleaned.length < 7 || cleaned.length > 8) {
      setError('Ingresá un DNI válido (7 u 8 dígitos, sin puntos)');
      return;
    }
    setDni(cleaned);
    try {
      const res = await api.post<CheckResponse>('/client-portal/check', { dni: cleaned });
      const data = res.data;
      if (data.status === 'NOT_FOUND') {
        setStep('register');
      } else if (data.status === 'NEEDS_PASSWORD') {
        setFirstName(data.firstName || '');
        setVerifyBy(data.verifyBy || 'none');
        setStep('claim');
      } else {
        setFirstName(data.firstName || '');
        setStep('login');
      }
    } catch (err) {
      handleError(err, 'No pudimos verificar tu DNI. Probá de nuevo.');
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    try {
      await clientPortalClaim({
        dni,
        phone: verifyBy === 'phone' ? verifyValue : undefined,
        email: verifyBy === 'email' ? verifyValue : undefined,
        password,
      });
      navigate('/app/home', { replace: true });
    } catch (err) {
      handleError(err, 'No pudimos crear tu contraseña. Probá de nuevo.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await clientPortalLogin({ dni, password });
      navigate('/app/home', { replace: true });
    } catch (err) {
      handleError(err, 'Credenciales inválidas');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!regFirstName.trim() || !regLastName.trim()) {
      setError('Completá tu nombre y apellido');
      return;
    }
    if (regPhone.replace(/\D/g, '').length < 6) {
      setError('Ingresá un teléfono válido');
      return;
    }
    const email = regEmail.trim();
    if (!email) {
      setError('Ingresá tu email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresá un email válido');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    try {
      await clientPortalRegister({
        dni,
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        phone: regPhone.trim(),
        email,
        password,
      });
      navigate('/app/home', { replace: true });
    } catch (err) {
      handleError(err, 'No pudimos crear tu cuenta. Probá de nuevo.');
    }
  };

  const backToDni = () => {
    setStep('dni');
    setError('');
    setPassword('');
    setConfirmPassword('');
    setVerifyValue('');
  };

  const passwordFields = (label: string) => (
    <>
      <div>
        <label htmlFor="portal-password" className="label">{label}</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            id="portal-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="input pl-10 pr-10 py-2.5 bg-white"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="portal-confirm" className="label">Repetir contraseña</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            id="portal-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="input pl-10 py-2.5 bg-white"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
      </div>
    </>
  );

  const titles: Record<PortalStep, { title: string; subtitle: string }> = {
    dni: {
      title: 'Portal de clientes',
      subtitle: 'Ingresá tu DNI para entrar o registrarte',
    },
    claim: {
      title: `¡Hola${firstName ? ` ${firstName}` : ''}!`,
      subtitle: 'Ya estás en el club. Creá tu contraseña para entrar.',
    },
    login: {
      title: `¡Hola de nuevo${firstName ? ` ${firstName}` : ''}!`,
      subtitle: 'Ingresá tu contraseña para continuar',
    },
    register: {
      title: 'Sos nuevo por acá',
      subtitle: `Registramos el DNI ${dni}. Completá tus datos para crear tu cuenta.`,
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-amber-100 px-4 py-8 relative overflow-hidden">
      {/* Decoración de fondo */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-primary-200/50 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 w-72 h-72 bg-primary-100/40 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative animate-fade-in-up">
        <div className="text-center mb-8">
          <img
            src={logoUrl}
            alt="Robles Club"
            className="w-36 h-36 sm:w-40 sm:h-40 rounded-3xl object-cover mx-auto mb-5 shadow-2xl shadow-primary-900/20 ring-4 ring-white"
          />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Robles <span className="text-primary-600">Club</span>
          </h1>
          <h2 className="mt-2 text-lg font-semibold text-gray-800">{titles[step].title}</h2>
          <p className="mt-1 text-gray-500">{titles[step].subtitle}</p>
        </div>

        <div className="card p-6 sm:p-8 shadow-xl shadow-gray-900/5 border-white/80">
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {step !== 'dni' && (
            <button
              type="button"
              onClick={backToDni}
              className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Cambiar DNI
            </button>
          )}

          {/* PASO 1: DNI */}
          {step === 'dni' && (
            <form onSubmit={handleCheckDni} className="space-y-4">
              <div>
                <label htmlFor="portal-dni" className="label">DNI</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="portal-dni"
                    type="text"
                    inputMode="numeric"
                    className="input pl-10 py-2.5 bg-white"
                    placeholder="Ej: 30123456"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Si ya te cargó el local, vas a crear tu contraseña. Si no, podés registrarte.
                </p>
              </div>

              <button type="submit" disabled={isLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-600/30 hover:from-primary-700 hover:to-primary-600 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verificando...
                  </span>
                ) : (
                  'Continuar'
                )}
              </button>
            </form>
          )}

          {/* PASO 2a: cuenta dada de alta -> crear contraseña */}
          {step === 'claim' && (
            <form onSubmit={handleClaim} className="space-y-4">
              {verifyBy === 'phone' && (
                <div>
                  <label htmlFor="portal-phone" className="label">Teléfono registrado en el local</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="portal-phone"
                      type="tel"
                      className="input pl-10 py-2.5 bg-white"
                      placeholder="Ej: 11 2345 6789"
                      value={verifyValue}
                      onChange={(e) => setVerifyValue(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Lo pedimos para confirmar que sos vos.
                  </p>
                </div>
              )}

              {verifyBy === 'email' && (
                <div>
                  <label htmlFor="portal-email-verify" className="label">Email registrado en el local</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="portal-email-verify"
                      type="email"
                      className="input pl-10 py-2.5 bg-white"
                      placeholder="tu@email.com"
                      value={verifyValue}
                      onChange={(e) => setVerifyValue(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Lo pedimos para confirmar que sos vos.
                  </p>
                </div>
              )}

              {passwordFields('Crear contraseña')}

              <button type="submit" disabled={isLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-600/30 hover:from-primary-700 hover:to-primary-600 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creando...
                  </span>
                ) : (
                  'Crear contraseña y entrar'
                )}
              </button>
            </form>
          )}

          {/* PASO 2b: cuenta con contraseña -> login */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="portal-login-password" className="label">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="portal-login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="input pl-10 pr-10 py-2.5 bg-white"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-600/30 hover:from-primary-700 hover:to-primary-600 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Ingresando...
                  </span>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
          )}

          {/* PASO 2c: no existe -> registro */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="portal-reg-first" className="label">Nombre</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="portal-reg-first"
                      type="text"
                      className="input pl-10 py-2.5 bg-white"
                      placeholder="Juan"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="portal-reg-last" className="label">Apellido</label>
                  <input
                    id="portal-reg-last"
                    type="text"
                    className="input py-2.5 bg-white"
                    placeholder="Pérez"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="portal-reg-phone" className="label">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="portal-reg-phone"
                    type="tel"
                    className="input pl-10 py-2.5 bg-white"
                    placeholder="Ej: 11 2345 6789"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Te lo pedimos para verificar tu identidad si algún día perdés tu contraseña.
                </p>
              </div>

              <div>
                <label htmlFor="portal-reg-email" className="label">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="portal-reg-email"
                    type="email"
                    className="input pl-10 py-2.5 bg-white"
                    placeholder="tu@email.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {passwordFields('Contraseña')}

              <button type="submit" disabled={isLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-600/30 hover:from-primary-700 hover:to-primary-600 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creando cuenta...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Crear mi cuenta y entrar
                  </span>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Programa de beneficios de Pinturería Robles
        </p>
      </div>
    </div>
  );
}
