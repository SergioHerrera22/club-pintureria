import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Gift, TrendingUp, Ticket, QrCode } from 'lucide-react';
import { cn } from '../lib/utils';

interface TabItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { label: 'Inicio', path: '/app/home', icon: Home },
  { label: 'Premios', path: '/app/prizes', icon: Gift },
  { label: 'Puntos', path: '/app/points', icon: TrendingUp },
  { label: 'Cupones', path: '/app/coupons', icon: Ticket },
  { label: 'Mi QR', path: '/app/qr', icon: QrCode },
];

/**
 * Barra de navegación inferior fija del portal del cliente (/app/*).
 * Se monta una sola vez en el layout de rutas de cliente.
 */
export default function ClientTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-4xl grid grid-cols-5">
        {TABS.map((tab) => {
          const active = pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                active ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
