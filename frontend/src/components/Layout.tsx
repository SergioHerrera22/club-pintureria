import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { cn, getRoleLabel, getRoleColor } from '../lib/utils';
import logoUrl from '../assets/robles-logo.png';
// @ts-ignore
import { LayoutDashboard, Users, Package, Settings, LogOut, User, Tag, Menu, X, DollarSign, Building, Megaphone, Gift, Layers, Trophy, Ticket, UserCircle, UserPlus, MessageCircle } from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'CAJERA'] },
  { name: 'Nuevo Cliente', href: '/nuevo-cliente', icon: UserPlus, roles: ['ADMIN', 'CAJERA'] },
  { name: 'Nuevo Cliente', href: '/vendedor/nuevo-cliente', icon: UserPlus, roles: ['VENDEDOR'] },
  { name: 'Clientes', href: '/clients', icon: Users, roles: ['ADMIN', 'CAJERA'] },
  { name: 'Ventas', href: '/sales', icon: DollarSign, roles: ['CAJERA'] },
  { name: 'Usuarios', href: '/admin-users', icon: UserCircle, roles: ['ADMIN'] },
  { name: 'Campañas WhatsApp', href: '/campaigns', icon: MessageCircle, roles: ['ADMIN', 'CAJERA'] },
  { name: 'Productos', href: '/products', icon: Package, roles: ['ADMIN'] },
  { name: 'Reglas de Puntos', href: '/point-rules', icon: Settings, roles: ['ADMIN'] },
  { name: 'Premios', href: '/prizes', icon: Tag, roles: ['ADMIN', 'CAJERA'] },
  { name: 'Sucursales', href: '/branches', icon: Building, roles: ['ADMIN'] },
  { name: 'Marcas', href: '/brands', icon: Tag, roles: ['ADMIN'] },
  { name: 'Categorías', href: '/categories', icon: Layers, roles: ['ADMIN'] },
  { name: 'Promociones', href: '/promotions', icon: Megaphone, roles: ['ADMIN', 'CAJERA'] },
  { name: 'Cupones', href: '/coupons', icon: Ticket, roles: ['ADMIN', 'CAJERA'] },
  { name: 'Desafíos', href: '/challenges', icon: Trophy, roles: ['ADMIN', 'CAJERA'] },
  { name: 'Beneficios', href: '/benefits', icon: Gift, roles: ['ADMIN', 'CAJERA'] },
  { name: 'Configuración', href: '/system-config', icon: Settings, roles: ['ADMIN'] },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const filteredNav = navigation.filter(item => 
    !item.roles || (user && item.roles.includes(user.role))
  );
  
  return (
    <div className="min-h-screen bg-gray-50">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Sidebar"
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 lg:justify-center">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Robles Club" className="w-9 h-9 rounded-lg object-cover" />
            <h1 className="text-xl font-bold text-primary-600">Club Robles</h1>
          </div>
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
            {filteredNav.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.href}
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
                  {item.name}
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
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="Robles Club" className="w-8 h-8 rounded-lg object-cover" />
              <h1 className="text-xl font-bold text-primary-600">Club Robles</h1>
            </div>
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