import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: { resource: string; action: string };
}

const ProtectedRoute = ({ children, requiredPermission }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1729] to-[#1b254b]">
        <div className="flex flex-col items-center gap-4">
          <Icon name="Loader2" size={48} className="text-primary animate-spin" />
          <div className="text-white text-lg">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission) {
    const { resource, action } = requiredPermission;
    
    // Если у пользователя есть роль "Администратор", даём полный доступ
    const isAdmin = user.roles?.some(role => role.name === 'Администратор' || role.name === 'Admin');
    
    if (!isAdmin) {
      const hasPermission = user.permissions?.some(
        (p) => p.resource === resource && p.action === action
      );

      if (!hasPermission) {
        return <Navigate to="/" replace />;
      }
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;