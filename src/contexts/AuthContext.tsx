import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { API_URL, apiFetch, invalidateCache } from '@/utils/api';
import { clearBootstrapCache } from '@/utils/bootstrapCache';

interface Permission {
  name: string;
  resource: string;
  action: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  system_role?: string;
  permissions?: Permission[];
}

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  photo_url?: string;
  is_active: boolean;
  last_login: string | null;
  roles: Role[];
  permissions: Permission[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  activeRole: Role | null;
  setActiveRole: (role: Role) => void;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  hasPermission: (resource: string, action: string) => boolean;
  hasExactPermission: (resource: string, action: string) => boolean;
  hasSystemRole: (...roles: string[]) => boolean;
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
  const [activeRole, setActiveRoleState] = useState<Role | null>(() => {
    try {
      const saved = sessionStorage.getItem('active_role');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
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
  
  // Хелпер для получения токена из storage
  const getStoredToken = () => {
    const rememberMe = localStorage.getItem('remember_me') === 'true';
    return rememberMe 
      ? localStorage.getItem('auth_token')
      : sessionStorage.getItem('auth_token');
  };
  
  // Хелпер для сохранения токена
  const saveToken = (newToken: string) => {
    const rememberMe = localStorage.getItem('remember_me') === 'true';
    if (rememberMe) {
      localStorage.setItem('auth_token', newToken);
    } else {
      sessionStorage.setItem('auth_token', newToken);
    }
  };
  
  const setActiveRole = (role: Role) => {
    setActiveRoleState(role);
    try { sessionStorage.setItem('active_role', JSON.stringify(role)); } catch { /* ignore */ }
  };

  const applyUser = (userData: User) => {
    setUser(userData);
    setActiveRoleState(prev => {
      const roles = userData.roles ?? [];
      if (roles.length === 0) return null;
      if (prev && roles.find(r => r.id === prev.id)) {
        const fresh = roles.find(r => r.id === prev.id)!;
        try { sessionStorage.setItem('active_role', JSON.stringify(fresh)); } catch { /* ignore */ }
        return fresh;
      }
      try { sessionStorage.setItem('active_role', JSON.stringify(roles[0])); } catch { /* ignore */ }
      return roles[0];
    });
  };

  const logout = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    setToken(null);
    setUser(null);
    setActiveRoleState(null);
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('active_role');
    localStorage.removeItem('remember_me');
    clearBootstrapCache();
    invalidateCache();
  };
  
  const refreshToken = async () => {
    const currentToken = getStoredToken();
    
    if (!currentToken) return;

    try {
      const response = await apiFetch(`${API_URL}?endpoint=refresh`, {
        headers: {
          'X-Auth-Token': currentToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token && data.user) {
          setToken(data.token);
          applyUser(data.user);
          saveToken(data.token);
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  };

  // Запрос токена у других открытых вкладок (для случая, когда заявка
  // открыта в новой вкладке, а токен лежит в sessionStorage текущей сессии).
  const requestTokenFromOtherTabs = (): Promise<string | null> => {
    if (typeof BroadcastChannel === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
      let channel: BroadcastChannel | null = null;
      let done = false;
      const finish = (value: string | null) => {
        if (done) return;
        done = true;
        try { channel?.close(); } catch { /* ignore */ }
        resolve(value);
      };
      try {
        channel = new BroadcastChannel('auth-sync');
        channel.onmessage = (e) => {
          if (e.data?.type === 'token-response' && e.data.token) {
            finish(e.data.token as string);
          }
        };
        channel.postMessage({ type: 'request-token' });
      } catch {
        finish(null);
        return;
      }
      // Ждём ответ не дольше 700мс, иначе считаем что других вкладок нет
      setTimeout(() => finish(null), 700);
    });
  };

  const checkAuth = async () => {
    let savedToken = getStoredToken();
    
    console.log('[checkAuth] savedToken:', savedToken ? 'exists' : 'null');
    
    if (!savedToken) {
      // Возможно, токен есть в другой вкладке (sessionStorage не шарится).
      const sharedToken = await requestTokenFromOtherTabs();
      if (sharedToken) {
        console.log('[checkAuth] Got token from another tab');
        sessionStorage.setItem('auth_token', sharedToken);
        savedToken = sharedToken;
      }
    }

    if (!savedToken) {
      console.log('[checkAuth] No token found, skipping auth check');
      setLoading(false);
      return;
    }

    try {
      console.log('[checkAuth] Verifying token with backend...');
      const response = await apiFetch(`${API_URL}?endpoint=me`, {
        headers: {
          'X-Auth-Token': savedToken,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('[checkAuth] Token valid, user:', userData.username);
        applyUser(userData);
        setToken(savedToken);
      } else {
        console.log('[checkAuth] Token invalid, status:', response.status);
        logout();
      }
    } catch (error) {
      console.error('[checkAuth] Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Отвечаем другим вкладкам, которые просят токен текущей сессии.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('auth-sync');
    channel.onmessage = (e) => {
      if (e.data?.type === 'request-token') {
        const current = getStoredToken();
        if (current) {
          channel.postMessage({ type: 'token-response', token: current });
        }
      }
    };
    return () => {
      try { channel.close(); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    if (user && token) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      
      // Используем ту же функцию refreshToken
      refreshIntervalRef.current = setInterval(() => {
        refreshToken();
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
    console.log('[Login v2] Starting login request...', { username, url: `${API_URL}?endpoint=login` });
    
    try {
      const response = await apiFetch(`${API_URL}?endpoint=login`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      console.log('[Login v2] Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('[Login] Error response:', error);
        throw new Error(error.error || 'Ошибка входа');
      }

      const data = await response.json();
      console.log('[Login] Success! Token received');
      setToken(data.token);
      applyUser(data.user);
      
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

  const getActivePermissions = (): Permission[] => {
    if (!user) return [];
    const roles = user.roles ?? [];
    if (roles.length <= 1) return user.permissions ?? [];
    if (!activeRole) return user.permissions ?? [];
    return activeRole.permissions ?? [];
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;

    const roles = user.roles ?? [];
    const effectiveRole = roles.length <= 1 ? (roles[0] ?? null) : activeRole;

    if (effectiveRole?.name === 'Администратор' || effectiveRole?.name === 'Admin') return true;
    if (!effectiveRole && roles.some(r => r.name === 'Администратор' || r.name === 'Admin')) return true;

    const perms = getActivePermissions();
    if (!perms.length) return false;

    if (resource === 'users' && perms.some((p) => p.resource === 'users' && p.action === 'access')) {
      return true;
    }

    return perms.some((p) => p.resource === resource && p.action === action);
  };

  const hasExactPermission = (resource: string, action: string): boolean => {
    return getActivePermissions().some((p) => p.resource === resource && p.action === action);
  };

  const hasSystemRole = (...roles: string[]): boolean => {
    if (!user?.roles) return false;
    const effectiveRoles = (user.roles ?? []).length <= 1 ? user.roles : (activeRole ? [activeRole] : user.roles);
    return effectiveRoles.some(role => role.system_role && roles.includes(role.system_role));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, activeRole, setActiveRole, login, logout, hasPermission, hasExactPermission, hasSystemRole, checkAuth, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};