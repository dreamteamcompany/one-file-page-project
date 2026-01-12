import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { useAuth } from '@/contexts/AuthContext';
import UsersHeader from '@/components/users/UsersHeader';
import UserFormDialog from '@/components/users/UserFormDialog';
import UsersTable from '@/components/users/UsersTable';
import UsersMobileList from '@/components/users/UsersMobileList';

interface User {
  id: number;
  username: string;
  full_name: string;
  position: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  photo_url?: string;
  roles: { id: number; name: string }[];
}

interface Role {
  id: number;
  name: string;
  description: string;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    position: '',
    role_ids: [] as number[],
    photo_url: '',
  });

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

  const loadUsers = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=users', {
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
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=roles', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoles(Array.isArray(data) ? data : []);
      } else {
        setRoles([]);
      }
    } catch (err) {
      console.error('Failed to load roles:', err);
      setRoles([]);
    }
  };

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingUser 
        ? `https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=users&id=${editingUser.id}`
        : 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=users';
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const body: any = {
        username: formData.username,
        full_name: formData.full_name,
        position: formData.position,
        role_ids: formData.role_ids,
      };
      
      if (formData.password) {
        body.password = formData.password;
      }
      
      if (formData.photo_url) {
        body.photo_url = formData.photo_url;
      }
      
      const response = await fetch(url, {
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
        });
        loadUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка при сохранении пользователя');
      }
    } catch (err) {
      console.error('Failed to save user:', err);
      alert('Ошибка при сохранении пользователя');
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=users&id=${userId}`, {
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

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${userName}"?`)) return;
    
    try {
      const response = await fetch(`https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=users&id=${userId}`, {
        method: 'DELETE',
        headers: {
          'X-Auth-Token': token || '',
        },
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

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name,
      position: user.position || '',
      password: '',
      role_ids: user.roles?.map(r => r.id).filter(id => id !== undefined) || [],
      photo_url: user.photo_url || '',
    });
    setDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen">
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

      <main className="lg:ml-[250px] p-4 md:p-6 lg:p-[30px] min-h-screen flex-1 overflow-x-hidden max-w-full">
        <UsersHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Пользователи</h1>
            <p className="text-sm md:text-base text-muted-foreground">Управление пользователями системы</p>
          </div>
          <UserFormDialog
            dialogOpen={dialogOpen}
            setDialogOpen={setDialogOpen}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            formData={formData}
            setFormData={setFormData}
            roles={roles}
            handleSubmit={handleSubmit}
          />
        </div>

        <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Нет пользователей. Добавьте первого пользователя.
              </div>
            ) : (
              <>
                <UsersTable
                  users={users}
                  onEdit={handleEditUser}
                  onToggleStatus={toggleUserStatus}
                  onDelete={handleDeleteUser}
                />
                <UsersMobileList
                  users={users}
                  onEdit={handleEditUser}
                  onToggleStatus={toggleUserStatus}
                  onDelete={handleDeleteUser}
                />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Users;