import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import logoUrl from '../assets/robles-logo.png';
import { cn } from '../lib/utils';
import { Mail, AlertCircle, Loader2, ArrowLeft, CheckCircle2, Send } from 'lucide-react';

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

/**
 * Recuperación de contraseña (personal): pedís el correo y el backend manda un
 * enlace de un solo uso (30 min). Siempre responde lo mismo para no revelar
 * si el correo está registrado.
 */
export default function ForgotPassword() {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: ForgotForm) => {
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo procesar el pedido. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-amber-100 px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-primary-200/50 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative animate-fade-in-up">
        <div className="text-center mb-8">
          <img
            src={logoUrl}
            alt="Robles Club"
            className="w-32 h-32 rounded-3xl object-cover mx-auto mb-5 shadow-2xl shadow-primary-900/20 ring-4 ring-white"
          />
          <h1 className="text-xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="text-gray-500 text-sm">Te enviaremos un enlace a tu correo</p>
        </div>

        <div className="card p-6 sm:p-8 shadow-xl shadow-gray-900/5 border-white/80">
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {sent ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-semibold text-gray-900">Revisá tu correo</p>
              <p className="text-sm text-gray-600">
                Si el correo está registrado, vas a recibir un enlace para crear una nueva contraseña.
                Vence en 30 minutos.
              </p>
              <p className="text-xs text-gray-400">
                ¿No te llegó? Revisá la carpeta de spam o pedí el enlace de nuevo.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('email')}
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={cn(
                      'input pl-10 py-2.5 bg-white',
                      errors.email && 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    )}
                    placeholder="tu-email@robles.com"
                    disabled={loading}
                  />
                </div>
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-600/30 hover:from-primary-700 hover:to-primary-600 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Send className="w-5 h-5" /> Enviar enlace
                  </span>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-gray-100 text-center text-sm">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" /> Volver a iniciar sesión
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          ¿Sos cliente del club? Entrá a tu portal desde{' '}
          <Link to="/users" className="text-primary-600 hover:underline">tu portal</Link>.
        </p>
      </div>
    </div>
  );
}
