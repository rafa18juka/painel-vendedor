import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './app/login/LoginPage';
import { PainelPage } from './app/painel/PainelPage';
import { AdminPage } from './app/admin/AdminPage';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute({ children, allow }: { children: JSX.Element; allow: ('admin' | 'coordenadora' | 'vendedora')[] }) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-lg">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/painel'} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/painel"
        element={
          <ProtectedRoute allow={['coordenadora', 'vendedora']}>
            <PainelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allow={['admin']}>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
