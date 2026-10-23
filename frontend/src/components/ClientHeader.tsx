import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, UserCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import logoUrl from '../assets/robles-logo.png';

interface ClientHeaderProps {
  /** Título de la página (opcional: en la home el logo representa la marca) */
  title?: string;
  subtitle?: React.ReactNode;
  backTo?: string;
  maxWidth?: 'md' | '3xl' | '4xl';
  /** Contenido opcional a la derecha (antes del botón salir) */
  right?: React.ReactNode;
}

export default function ClientHeader({ title, subtitle, backTo, maxWidth = '4xl', right }: ClientHeaderProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/users');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className={cn('mx-auto px-4 py-4', maxWidth === 'md' ? 'max-w-md' : maxWidth === '3xl' ? 'max-w-3xl' : 'max-w-4xl')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {backTo && (
              <button
                onClick={() => navigate(backTo)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Volver"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <img
              src={logoUrl}
              alt="Robles Club"
              className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
            />
            <div className="min-w-0">
              {title && <h1 className="text-xl font-bold text-gray-900 truncate">{title}</h1>}
              {subtitle && <p className={cn('text-sm text-gray-500 truncate', !title && 'font-medium text-gray-900')}>{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {right}
            <button
              onClick={() => navigate('/app/profile')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Mi perfil"
              aria-label="Mi perfil"
            >
              <UserCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Perfil</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
