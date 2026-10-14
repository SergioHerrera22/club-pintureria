import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import logoUrl from '../assets/robles-logo.png';
import { cn, getHomeForRole } from '../lib/utils';
import { Lock, Mail, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });
  
  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      await login(data.email, data.password);
      navigate(getHomeForRole(useAuthStore.getState().user?.role));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Credenciales inválidas');
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-amber-100 px-4 py-10 relative overflow-hidden">
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
          <p className="mt-1.5 text-gray-500">Panel de personal · Iniciá sesión para continuar</p>
        </div>

        <div className="card p-6 sm:p-8 shadow-xl shadow-gray-900/5 border-white/80">
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}
          
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
                  placeholder="admin@clubpintureria.com"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="label">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={cn(
                    'input pl-10 pr-10 py-2.5 bg-white',
                    errors.password && 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  )}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-600/30 hover:from-primary-700 hover:to-primary-600 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
          
          <div className="mt-6 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
            <p>
              ¿Sos cliente?{' '}
              <Link to="/users" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
                Entrá a tu portal por acá
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Programa de beneficios de Pinturería Robles
        </p>
      </div>
    </div>
  );
}