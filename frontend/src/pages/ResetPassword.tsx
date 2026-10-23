import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import logoUrl from '../assets/robles-logo.png';
import { cn } from '../lib/utils';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

const resetSchema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  });

type ResetForm = z.infer<typeof resetSchema>;

/**
 * Nueva contraseña a partir del enlace enviado por correo
 * (/reset-password?token=...). El token es de un solo uso y vence en 30 min.
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (data: ResetForm) => {
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo actualizar la contraseña.');
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
          <h1 className="text-xl font-bold text-gray-900">Crear nueva contraseña</h1>
        </div>

        <div className="card p-6 sm:p-8 shadow-xl shadow-gray-900/5 border-white/80">
          {!token ? (
            <div className="text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="font-semibold text-gray-900">Enlace inválido</p>
              <p className="text-sm text-gray-600">
                El enlace no tiene el código de recuperación. Pedí uno nuevo desde el login.
              </p>
              <Link to="/forgot-password" className="inline-block btn-primary mt-2">
                Pedir enlace
              </Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-semibold text-gray-900">Contraseña actualizada</p>
              <p className="text-sm text-gray-600">Te llevamos al login...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="password" className="label">Nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      {...register('password')}
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      className={cn(
                        'input pl-10 py-2.5 bg-white',
                        errors.password && 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      )}
                      placeholder="••••••••"
                    />
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
                </div>

                <div>
                  <label htmlFor="confirm" className="label">Repetir contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      {...register('confirm')}
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      className={cn(
                        'input pl-10 py-2.5 bg-white',
                        errors.confirm && 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      )}
                      placeholder="••••••••"
                    />
                  </div>
                  {errors.confirm && <p className="mt-1 text-sm text-red-600">{errors.confirm.message}</p>}
                </div>

                <button type="submit" className="btn-primary w-full py-3">
                  Guardar contraseña
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
