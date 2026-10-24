import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useEffect } from 'react';
import { getHomeForRole } from './lib/utils';
import { hasMenuPermission, getHomeForUser } from './lib/permissions';
import Layout from './components/Layout';
import ClientTabBar from './components/ClientTabBar';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ClientPortal from './pages/ClientPortal';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientRegister from './pages/ClientRegister';
import ClientDetail from './pages/ClientDetail';
import Products from './pages/Products';
import PointRules from './pages/PointRules';
import Prizes from './pages/Prizes';
import Profile from './pages/Profile';
import ClientPoints from './pages/ClientPoints';
import ClientHome from './pages/ClientHome';
import ClientPromotions from './pages/ClientPromotions';
import ClientCoupons from './pages/ClientCoupons';
import ClientChallenges from './pages/ClientChallenges';
import ClientQR from './pages/ClientQR';
import ClientPurchases from './pages/ClientPurchases';
import ClientProfessional from './pages/ClientProfessional';
import ClientPrizes from './pages/ClientPrizes';
import ClientPointsHistory from './pages/ClientPointsHistory';
import ClientProfile from './pages/ClientProfile';
import Sales from './pages/Sales';
import CurrentAccounts from './pages/CurrentAccounts';
import MisVentas from './pages/MisVentas';
import SaleRevisions from './pages/SaleRevisions';
import Branches from './pages/Branches';
import Brands from './pages/Brands';
import Categories from './pages/Categories';
import Promotions from './pages/Promotions';
import Coupons from './pages/Coupons';
import Challenges from './pages/Challenges';
import Benefits from './pages/Benefits';
import SystemConfig from './pages/SystemConfig';
import AdminUsers from './pages/AdminUsers';
import Campaigns from './pages/Campaigns';


function ProtectedRoute({ children, allowedRoles, permission }: { children: React.ReactNode; allowedRoles?: string[]; permission?: string }) {
  const { isAuthenticated, user, refreshUser } = useAuthStore();
  
  useEffect(() => {
    if (isAuthenticated && !user) {
      refreshUser();
    }
  }, [isAuthenticated, user, refreshUser]);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={getHomeForRole(user.role)} replace />;
  }
  
  // Permisos personalizados por usuario: si no tiene la sección habilitada,
  // lo manda a la primera sección permitida (evita entrar por URL).
  if (permission && user && !hasMenuPermission(user, permission)) {
    return <Navigate to={getHomeForUser(user)} replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  
  if (isAuthenticated) {
    return <Navigate to={getHomeForRole(user?.role)} replace />;
  }
  
  return <>{children}</>;
}

/**
 * Layout del portal del cliente: agrega la barra de navegación inferior
 * y el padding inferior para que no tape el contenido de cada página.
 */
function ClientAppLayout() {
  return (
    <div className="min-h-screen pb-16">
      <Outlet />
      <ClientTabBar />
    </div>
  );
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getHomeForRole(user?.role)} replace />;
}

function App() {
  const { isAuthenticated, refreshUser } = useAuthStore();
  
  useEffect(() => {
    if (isAuthenticated) {
      refreshUser();
    }
  }, [isAuthenticated, refreshUser]);
  
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      {/* Portal de clientes: alta y login autogestionados por DNI */}
      <Route path="/users" element={<PublicRoute><ClientPortal /></PublicRoute>} />
      
      {/* Admin/Cajera/Vendedor routes with Layout.
          Las rutas admin-only tienen su propio allowedRoles; el resto queda
          gobernado por los permisos personalizados de cada usuario. */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA', 'VENDEDOR']}><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/nuevo-cliente" element={<ProtectedRoute permission="nuevo-cliente"><ClientRegister /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute permission="ventas"><Sales /></ProtectedRoute>} />
        <Route path="/current-accounts" element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA', 'VENDEDOR']} permission="cuentas-corrientes"><CurrentAccounts /></ProtectedRoute>} />
        <Route path="/mis-ventas" element={<ProtectedRoute permission="mis-ventas"><MisVentas /></ProtectedRoute>} />
        <Route path="/sale-revisions" element={<ProtectedRoute allowedRoles={['ADMIN']} permission="revisiones-ventas"><SaleRevisions /></ProtectedRoute>} />
        <Route path="/campaigns" element={<ProtectedRoute permission="campanas"><Campaigns /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute allowedRoles={['ADMIN']} permission="productos"><Products /></ProtectedRoute>} />
        <Route path="/point-rules" element={<ProtectedRoute allowedRoles={['ADMIN']} permission="reglas-puntos"><PointRules /></ProtectedRoute>} />
        <Route path="/prizes" element={<ProtectedRoute permission="premios"><Prizes /></ProtectedRoute>} />
        <Route path="/branches" element={<ProtectedRoute allowedRoles={['ADMIN']} permission="sucursales"><Branches /></ProtectedRoute>} />
        <Route path="/brands" element={<ProtectedRoute allowedRoles={['ADMIN']} permission="marcas"><Brands /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute allowedRoles={['ADMIN']} permission="categorias"><Categories /></ProtectedRoute>} />
        <Route path="/promotions" element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']} permission="promociones"><Promotions /></ProtectedRoute>} />
        <Route path="/coupons" element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']} permission="cupones"><Coupons /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']} permission="desafios"><Challenges /></ProtectedRoute>} />
        <Route path="/benefits" element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']} permission="beneficios"><Benefits /></ProtectedRoute>} />
        <Route path="/system-config" element={<ProtectedRoute allowedRoles={['ADMIN']} permission="configuracion"><SystemConfig /></ProtectedRoute>} />
        <Route path="/admin-users" element={<ProtectedRoute allowedRoles={['ADMIN']} permission="usuarios"><AdminUsers /></ProtectedRoute>} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Clientes: accesible también para vendedores (solo lectura/edición de datos) */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA', 'VENDEDOR']}><Layout /></ProtectedRoute>}>
        <Route path="/clients" element={<ProtectedRoute permission="clientes"><Clients /></ProtectedRoute>} />
        <Route path="/clients/:dni" element={<ProtectedRoute permission="clientes"><ClientDetail /></ProtectedRoute>} />
      </Route>
      
      {/* Vendedor routes: solo puede cargar nuevos clientes */}
      <Route element={<ProtectedRoute allowedRoles={['VENDEDOR']}><Layout /></ProtectedRoute>}>
        <Route path="/vendedor/nuevo-cliente" element={<ProtectedRoute permission="nuevo-cliente"><ClientRegister /></ProtectedRoute>} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      
      {/* Client app routes - no Layout, full screen; con barra de navegación inferior */}
      <Route element={<ProtectedRoute allowedRoles={['CLIENTE']}><ClientAppLayout /></ProtectedRoute>}>
        <Route path="/app/home" element={<ClientHome />} />
        <Route path="/app/prizes" element={<ClientPrizes />} />
        <Route path="/app/points" element={<ClientPointsHistory />} />
        <Route path="/app/promotions" element={<ClientPromotions />} />
        <Route path="/app/coupons" element={<ClientCoupons />} />
        <Route path="/app/challenges" element={<ClientChallenges />} />
        <Route path="/app/qr" element={<ClientQR />} />
        <Route path="/app/purchases" element={<ClientPurchases />} />
        <Route path="/app/professional" element={<ClientProfessional />} />
        <Route path="/app/profile" element={<ClientProfile />} />
      </Route>
      
      {/* Public client points lookup */}
      <Route path="/points/:dni" element={<ClientPoints />} />
      
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default App;