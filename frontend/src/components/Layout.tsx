import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { cn, getRoleLabel, getRoleColor } from '../lib/utils';
import { MENU_ITEMS, hasMenuPermission, ADMIN_ONLY_MENU_KEYS } from '../lib/permissions';
import logoUrl from '../assets/RC.svg';
// @ts-ignore
import { LayoutDashboard, Users, Package, Settings, LogOut, User, Tag, Menu, X, DollarSign, Building, Megaphone, Gift, Layers, Trophy, Ticket, UserCircle, UserPlus, MessageCircle, type LucideIcon } from 'lucide-react';
import { useState, useEffect } from 'react';

const navIcons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  'nuevo-cliente': UserPlus,
  clientes: Users,
  ventas: DollarSign,
  usuarios: UserCircle,
  campanas: MessageCircle,
  productos: Package,
  'reglas-puntos': Settings,
  premios: Tag,
  sucursales: Building,
  marcas: Tag,
  categorias: Layers,
  promociones: Megaphone,
  cupones: Ticket,
  desafios: Trophy,
  beneficios: Gift,
  configuracion: Settings,
};

const navigation = MENU_ITEMS.map((item) => ({
  ...item,
  icon: navIcons[item.key] ?? User,
}));

export default function Layout() {
  const { user, logout, refreshUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Refrescar permisos del usuario al cambiar de ruta y al volver a la pestaña,
  // para que los cambios realizados por el administrador se reflejen sin esperar
  // el auto-refresh ni recargar la página.
  useEffect(() => {
    refreshUser();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshUser();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [refreshUser, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const filteredNav = navigation.filter(item => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    // Con permisos personalizados el menú muestra exactamente las secciones
    // habilitadas (salvo las solo-admin), aunque no sean del rol por defecto.
    if (Array.isArray(user.permissions)) {
      return !ADMIN_ONLY_MENU_KEYS.has(item.key) && user.permissions.includes(item.key);
    }
    return item.roles.includes(user.role) && hasMenuPermission(user, item.key);
  });

  // "Nuevo Cliente" tiene dos entradas (path /nuevo-cliente y /vendedor/nuevo-cliente).
  // Se muestra una sola por clave para que no aparezca duplicada en el menú.
  const seenKeys = new Set<string>();
  const uniqueNav = filteredNav.filter(item => {
    if (seenKeys.has(item.key)) return false;
    seenKeys.add(item.key);
    return true;
  });
  
  return (
    <div className="min-h-screen bg-gray-50">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Sidebar"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 lg:justify-center">
          <img src={logoUrl} alt="Robles Club" className="w-44 h-auto object-contain" />
          <button
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="mt-6 px-3 flex-1 overflow-y-auto" aria-label="Navegación principal">
          <ul className="space-y-1 pb-20" role="list">
            {uniqueNav.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="mt-6 p-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors"
            title="Editar perfil"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', getRoleColor(user?.role || ''))}>
                {getRoleLabel(user?.role || '')}
              </span>
              {user?.branch && user.role !== 'ADMIN' && (
                <p className="mt-1 text-xs text-gray-500 truncate" title={user.branch.name}>
                  <Building className="inline w-3 h-3 mr-1" />
                  {user.branch.name}
                </p>
              )}
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>
      
      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 lg:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <button
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="w-6 h-6" />
            </button>
            <img src={logoUrl} alt="Robles Club" className="h-12 w-auto object-contain" />
            <div className="w-10" />
          </div>
        </header>
        
        <main className="p-4 lg:p-6" id="main-content">
          <Outlet />
        </main>
      </div>
      
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}