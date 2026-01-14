import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { API_URL } from '@/utils/api';

interface Permission {
  name: string;
  resource: string;
  action: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  roles: Role[];
  permissions: Permission[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  hasPermission: (resource: string, action: string) => boolean;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    const rememberMe = localStorage.getItem('remember_me') === 'true';
    const token = rememberMe 
      ? localStorage.getItem('auth_token')
      : sessionStorage.getItem('auth_token');
    console.log('[Auth Init] rememberMe:', rememberMe, 'token:', token ? 'exists' : 'null');
    return token;
  });
  const [loading, setLoading] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cache-busting fix for production deployment
  
  const logout = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    localStorage.removeItem('remember_me');
  };
  
  const refreshToken = async () => {
    const rememberMe = localStorage.getItem('remember_me') === 'true';
    const currentToken = rememberMe 
      ? localStorage.getItem('auth_token')
      : sessionStorage.getItem('auth_token');
    
    if (!currentToken) return;

    try {
      const response = await fetch(`${API_URL}?endpoint=refresh`, {
        headers: {
          'X-Auth-Token': currentToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        setUser(data.user);
        
        if (rememberMe) {
          localStorage.setItem('auth_token', data.token);
        } else {
          sessionStorage.setItem('auth_token', data.token);
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  };

  const checkAuth = async () => {
    const rememberMe = localStorage.getItem('remember_me') === 'true';
    const savedToken = rememberMe 
      ? localStorage.getItem('auth_token')
      : sessionStorage.getItem('auth_token');
    
    console.log('[checkAuth] rememberMe:', rememberMe, 'savedToken:', savedToken ? 'exists' : 'null');
    
    if (!savedToken) {
      console.log('[checkAuth] No token found, skipping auth check');
      setLoading(false);
      return;
    }

    try {
      console.log('[checkAuth] Verifying token with backend...');
      const response = await fetch(`${API_URL}?endpoint=me`, {
        headers: {
          'X-Auth-Token': savedToken,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('[checkAuth] Token valid, user:', userData.username);
        setUser(userData);
        setToken(savedToken);
      } else {
        console.log('[checkAuth] Token invalid, status:', response.status);
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('remember_me');
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('[checkAuth] Auth check failed:', error);
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      localStorage.removeItem('remember_me');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && token) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      
      const doRefresh = async () => {
        const rememberMe = localStorage.getItem('remember_me') === 'true';
        const currentToken = rememberMe 
          ? localStorage.getItem('auth_token')
          : sessionStorage.getItem('auth_token');
        
        if (!currentToken) return;

        try {
          const response = await fetch(`${API_URL}?endpoint=refresh`, {
            headers: {
              'X-Auth-Token': currentToken,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setToken(data.token);
            setUser(data.user);
            
            if (rememberMe) {
              localStorage.setItem('auth_token', data.token);
            } else {
              sessionStorage.setItem('auth_token', data.token);
            }
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      };
      
      refreshIntervalRef.current = setInterval(() => {
        doRefresh();
      }, 6 * 60 * 60 * 1000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [user, token]);

  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    console.log('[Login] Starting login request...', { username, url: `${API_URL}?endpoint=login` });
    
    try {
      const response = await fetch(`${API_URL}?endpoint=login`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      console.log('[Login] Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('[Login] Error response:', error);
        throw new Error(error.error || 'Ошибка входа');
      }

      const data = await response.json();
      console.log('[Login] Success! Token received');
      setToken(data.token);
      setUser(data.user);
      
      if (rememberMe) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('remember_me', 'true');
      } else {
        sessionStorage.setItem('auth_token', data.token);
        localStorage.removeItem('remember_me');
      }
    } catch (error) {
      console.error('[Login] Network error:', error);
      throw error;
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;
    
    // Если у пользователя есть роль "Администратор", даём полный доступ
    if (user.roles?.some(role => role.name === 'Администратор' || role.name === 'Admin')) {
      return true;
    }
    
    if (!user.permissions) return false;
    return user.permissions.some(
      (p) => p.resource === resource && p.action === action
    );
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasPermission, checkAuth, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};