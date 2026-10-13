import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useEffect } from 'react';
import { getHomeForRole } from './lib/utils';
import Layout from './components/Layout';
import Login from './pages/Login';
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
import Sales from './pages/Sales';
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


function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
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
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  
  if (isAuthenticated) {
    return <Navigate to={getHomeForRole(user?.role)} replace />;
  }
  
  return <>{children}</>;
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
      
      {/* Admin/Cajera routes with Layout */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']}><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:dni" element={<ClientDetail />} />
        <Route path="/nuevo-cliente" element={<ClientRegister />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/products" element={<ProtectedRoute allowedRoles={['ADMIN']}><Products /></ProtectedRoute>} />
        <Route path="/point-rules" element={<ProtectedRoute allowedRoles={['ADMIN']}><PointRules /></ProtectedRoute>} />
        <Route path="/prizes" element={<Prizes />} />
        <Route path="/branches" element={<ProtectedRoute allowedRoles={['ADMIN']}><Branches /></ProtectedRoute>} />
        <Route path="/brands" element={<ProtectedRoute allowedRoles={['ADMIN']}><Brands /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute allowedRoles={['ADMIN']}><Categories /></ProtectedRoute>} />
        <Route path="/promotions" element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']}><Promotions /></ProtectedRoute>} />
        <Route path="/coupons" element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']}><Coupons /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']}><Challenges /></ProtectedRoute>} />
        <Route path="/benefits" element={<ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']}><Benefits /></ProtectedRoute>} />
        <Route path="/system-config" element={<ProtectedRoute allowedRoles={['ADMIN']}><SystemConfig /></ProtectedRoute>} />
        <Route path="/admin-users" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminUsers /></ProtectedRoute>} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      
      {/* Vendedor routes: solo puede cargar nuevos clientes */}
      <Route element={<ProtectedRoute allowedRoles={['VENDEDOR']}><Layout /></ProtectedRoute>}>
        <Route path="/vendedor/nuevo-cliente" element={<ClientRegister />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      
      {/* Client app routes - no Layout, full screen */}
      <Route element={<ProtectedRoute allowedRoles={['CLIENTE']}><div className="min-h-screen bg-gray-50" /></ProtectedRoute>}>
        <Route path="/app/home" element={<ClientHome />} />
        <Route path="/app/prizes" element={<ClientPrizes />} />
        <Route path="/app/points" element={<ClientPointsHistory />} />
        <Route path="/app/promotions" element={<ClientPromotions />} />
        <Route path="/app/coupons" element={<ClientCoupons />} />
        <Route path="/app/challenges" element={<ClientChallenges />} />
        <Route path="/app/qr" element={<ClientQR />} />
        <Route path="/app/purchases" element={<ClientPurchases />} />
        <Route path="/app/professional" element={<ClientProfessional />} />
      </Route>
      
      {/* Public client points lookup */}
      <Route path="/points/:dni" element={<ClientPoints />} />
      
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default App;