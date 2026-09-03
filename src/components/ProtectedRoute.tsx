import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: { resource: string; action: string };
  adminOnly?: boolean;
}

const ProtectedRoute = ({ children, requiredPermission, adminOnly }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Icon name="Loader2" size={48} className="text-primary animate-spin" />
          <div className="text-foreground text-lg">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Если у пользователя есть роль "Администратор", даём полный доступ
  const isAdmin = user.roles?.some(role => role.name === 'Администратор' || role.name === 'Admin');

  if (adminOnly && !isAdmin) {
    return <Navigate to="/tickets" replace />;
  }

  if (requiredPermission) {
    const { resource, action } = requiredPermission;

    if (!isAdmin) {
      const usersFullAccess =
        resource === 'users' &&
        user.permissions?.some((p) => p.resource === 'users' && p.action === 'access');

      const hasPermission =
        usersFullAccess ||
        user.permissions?.some(
          (p) => p.resource === resource && p.action === action
        );

      if (!hasPermission) {
        return <Navigate to="/tickets" replace />;
      }
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;