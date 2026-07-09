import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, apiFetch } from '@/utils/api';
import UsersHeader from '@/components/users/UsersHeader';
import UserFormDialog from '@/components/users/UserFormDialog';
import UsersTable from '@/components/users/UsersTable';

interface User {
  id: number;
  username: string;
  full_name: string;
  position: string;
  email?: string;
  bitrix_user_id?: string;
  max_user_id?: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  photo_url?: string;
  bypass_department_head_check?: boolean;
  is_bitrix_head?: boolean;
  department_id?: number | null;
  roles: { id: number; name: string }[];
}

interface Role {
  id: number;
  name: string;
  description: string;
}

interface Department {
  id: number;
  name: string;
  parent_id?: number | null;
}

const Users = () => {
  const { hasPermission, token } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesError, setRolesError] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    position: '',
    role_ids: [] as number[],
    photo_url: '',
    email: '',
    bitrix_user_id: '',
    max_user_id: '',
    department_id: null as number | null,
    subordinate_department_ids: [] as number[],
    subordinate_user_ids: [] as number[],
  });

  const loadDepartments = async () => {
    try {
      const response = await apiFetch('/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiFetch(`${API_URL}?endpoint=users`, {
        headers: {
          'X-Auth-Token': token || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    setRolesError(false);
    try {
      const response = await apiFetch(`${API_URL}?endpoint=roles`, {
        headers: {
          'X-Auth-Token': token || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoles(Array.isArray(data) ? data : []);
      } else {
        setRoles([]);
        setRolesError(true);
      }
    } catch (err) {
      console.error('Failed to load roles:', err);
      setRoles([]);
      setRolesError(true);
    }
  };

  useEffect(() => {
    if (!hasPermission('users', 'read')) {
      navigate('/tickets');
    }
  }, [hasPermission, navigate]);

  useEffect(() => {
    if (token) {
      loadUsers();
      loadRoles();
      loadDepartments();
    }
  }, [token]);

  if (!hasPermission('users', 'read')) {
    return null;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      setMenuOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const requiredPermission = editingUser ? 'update' : 'create';
    if (!hasPermission('users', requiredPermission)) {
      alert('У вас нет прав для этой операции');
      return;
    }
    
    try {
      const url = editingUser 
        ? `${API_URL}?endpoint=users&id=${editingUser.id}`
        : `${API_URL}?endpoint=users`;
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const body: Record<string, string | number[] | boolean | number | null> = {
        username: formData.username,
        full_name: formData.full_name,
        position: formData.position,
        role_ids: formData.role_ids,
        email: formData.email,
        bitrix_user_id: formData.bitrix_user_id,
        max_user_id: formData.max_user_id,
        department_id: formData.department_id,
        subordinate_department_ids: formData.subordinate_department_ids,
        subordinate_user_ids: formData.subordinate_user_ids,
      };
      
      if (formData.password) {
        body.password = formData.password;
      }
      
      if (formData.photo_url) {
        body.photo_url = formData.photo_url;
      }
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token || '',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setDialogOpen(false);
        setEditingUser(null);
        setFormData({
          username: '',
          password: '',
          full_name: '',
          position: '',
          role_ids: [],
          photo_url: '',
          email: '',
          bitrix_user_id: '',
          max_user_id: '',
          department_id: null,
          subordinate_department_ids: [],
          subordinate_user_ids: [],
        });
        loadUsers();
      } else {
        const error = await response.json().catch(() => ({}));
        alert(error.message || error.error || 'Ошибка при сохранении пользователя');
      }
    } catch (err) {
      console.error('Failed to save user:', err);
      alert('Ошибка при сохранении пользователя');
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    if (!hasPermission('users', 'update')) {
      alert('У вас нет прав для изменения статуса пользователя');
      return;
    }
    
    try {
      const response = await apiFetch(`${API_URL}?endpoint=users&id=${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token || '',
        },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      });

      if (response.ok) {
        loadUsers();
      }
    } catch (err) {
      console.error('Failed to toggle user status:', err);
    }
  };

  const toggleBypassDepartmentHead = async (userId: number, currentValue: boolean) => {
    if (!hasPermission('users', 'update')) {
      alert('У вас нет прав для изменения этой настройки');
      return;
    }
    
    try {
      const response = await apiFetch(`${API_URL}?endpoint=users&id=${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token || '',
        },
        body: JSON.stringify({
          bypass_department_head_check: !currentValue,
        }),
      });

      if (response.ok) {
        loadUsers();
        setEditingUser((prev: User | null) => prev ? { ...prev, bypass_department_head_check: !currentValue } : null);
      }
    } catch (err) {
      console.error('Failed to toggle bypass department head check:', err);
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!hasPermission('users', 'remove')) {
      alert('У вас нет прав для удаления пользователей');
      return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${userName}"?`)) return;
    
    try {
      const response = await apiFetch(`${API_URL}?endpoint=users`, {
        method: 'DELETE',
        body: JSON.stringify({ id: userId }),
      });

      if (response.ok) {
        loadUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка при удалении пользователя');
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Ошибка при удалении пользователя');
    }
  };

  const handleEditUser = async (user: User) => {
    if (!hasPermission('users', 'update')) {
      alert('У вас нет прав для редактирования пользователей');
      return;
    }
    
    setEditingUser(user);
    const emailVal = user.email && !user.email.includes('@placeholder.local') ? user.email : '';
    const baseData = {
      username: user.username,
      full_name: user.full_name,
      position: user.position || '',
      password: '',
      role_ids: user.roles?.map(r => r.id).filter(id => id !== undefined) || [],
      photo_url: user.photo_url || '',
      email: emailVal,
      bitrix_user_id: user.bitrix_user_id || '',
      max_user_id: user.max_user_id || '',
      department_id: user.department_id ?? null,
      subordinate_department_ids: [] as number[],
      subordinate_user_ids: [] as number[],
    };
    setFormData(baseData);
    setDialogOpen(true);

    try {
      const res = await apiFetch(`${API_URL}?endpoint=users&id=${user.id}`, {
        headers: { 'X-Auth-Token': token || '' },
      });
      if (res.ok) {
        const data = await res.json();
        setFormData({
          ...baseData,
          subordinate_department_ids: Array.isArray(data.subordinate_department_ids) ? data.subordinate_department_ids : [],
          subordinate_user_ids: Array.isArray(data.subordinate_user_ids) ? data.subordinate_user_ids : [],
        });
      }
    } catch (err) {
      console.error('Failed to load subordinates:', err);
    }
  };

  const activeUsers = users.filter((u) => u.is_active);
  const blockedUsers = users.filter((u) => !u.is_active);
  const baseUsers = showBlocked ? blockedUsers : activeUsers;
  const query = searchQuery.trim().toLowerCase();
  const visibleUsers = query
    ? baseUsers.filter((u) =>
        [u.full_name, u.username, u.position, u.email]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(query))
      )
    : baseUsers;

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <PaymentsSidebar
        menuOpen={menuOpen}
        dictionariesOpen={dictionariesOpen}
        setDictionariesOpen={setDictionariesOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
      />

      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="lg:ml-[250px] p-4 md:p-6 lg:p-[30px] min-h-screen flex-1 min-w-0 overflow-x-hidden">
        <UsersHeader
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Пользователи</h1>
            <p className="text-sm md:text-base text-muted-foreground">Управление пользователями системы</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant={showBlocked ? 'default' : 'outline'}
              onClick={() => setShowBlocked((v) => !v)}
              className="gap-2 w-full sm:w-auto"
            >
              <Icon name={showBlocked ? 'Users' : 'UserX'} size={18} />
              <span>
                {showBlocked
                  ? `Активные (${activeUsers.length})`
                  : `Заблокированные (${blockedUsers.length})`}
              </span>
            </Button>
            <UserFormDialog
            onToggleStatus={toggleUserStatus}
            onToggleBypassDepartmentHead={toggleBypassDepartmentHead}
            dialogOpen={dialogOpen}
            setDialogOpen={setDialogOpen}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            formData={formData}
            setFormData={setFormData}
            roles={roles}
            rolesError={rolesError}
            onRetryRoles={loadRoles}
            departments={departments}
            allUsers={users}
            handleSubmit={handleSubmit}
            canCreate={hasPermission('users', 'create')}
          />
          </div>
        </div>

        <Card className="border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
            ) : visibleUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {query
                  ? `Ничего не найдено по запросу «${searchQuery.trim()}».`
                  : showBlocked
                    ? 'Нет заблокированных пользователей.'
                    : 'Нет активных пользователей. Добавьте первого пользователя.'}
              </div>
            ) : (
              <UsersTable
                users={visibleUsers}
                departments={departments}
                onEdit={handleEditUser}
                onToggleStatus={toggleUserStatus}
                onDelete={handleDeleteUser}
                canUpdate={hasPermission('users', 'update')}
                canDelete={hasPermission('users', 'remove')}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Users;