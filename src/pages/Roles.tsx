import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';

interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  permissions?: Permission[];
  user_count: number;
}

const Roles = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permission_ids: [] as number[],
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

  const loadRoles = () => {
    apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=roles')
      .then(res => res.json())
      .then(data => {
        setRoles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load roles:', err);
        setRoles([]);
        setLoading(false);
      });
  };

  const loadPermissions = () => {
    apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=permissions')
      .then(res => res.json())
      .then(data => setPermissions(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('Failed to load permissions:', err);
        setPermissions([]);
      });
  };

  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=roles';
      const method = editingRole ? 'PUT' : 'POST';
      const body = editingRole 
        ? { ...formData, id: editingRole.id }
        : formData;

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setDialogOpen(false);
        setEditingRole(null);
        setFormData({
          name: '',
          description: '',
          permission_ids: [],
        });
        loadRoles();
      }
    } catch (err) {
      console.error('Failed to save role:', err);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permission_ids: role.permissions?.map(p => p.id) || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту роль?')) return;
    
    try {
      const response = await apiFetch(
        `https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=roles&id=${id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        loadRoles();
      }
    } catch (err) {
      console.error('Failed to delete role:', err);
    }
  };

  const togglePermission = (permId: number) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: prev.permission_ids.includes(permId)
        ? prev.permission_ids.filter(id => id !== permId)
        : [...prev.permission_ids, permId]
    }));
  };

  const getResourceIcon = (resource: string) => {
    switch (resource) {
      case 'payments':
        return 'CreditCard';
      case 'users':
        return 'Users';
      case 'roles':
        return 'Shield';
      case 'categories':
        return 'Tag';
      default:
        return 'Circle';
    }
  };

  const getResourceColor = (resource: string) => {
    switch (resource) {
      case 'payments':
        return 'text-blue-500 bg-blue-500/10';
      case 'users':
        return 'text-green-500 bg-green-500/10';
      case 'roles':
        return 'text-purple-500 bg-purple-500/10';
      case 'categories':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

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
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-[30px] px-4 md:px-[25px] py-4 md:py-[18px] bg-[#1b254b]/50 backdrop-blur-[20px] rounded-[15px] border border-white/10">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 text-white"
          >
            <Icon name="Menu" size={24} />
          </button>
          <div className="flex items-center gap-3 bg-card border border-white/10 rounded-[15px] px-4 md:px-5 py-2 md:py-[10px] w-full sm:w-[300px] lg:w-[400px]">
            <Icon name="Search" size={20} className="text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Поиск ролей..." 
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-[15px] py-2 md:py-[10px] rounded-[12px] bg-white/5 border border-white/10">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-[10px] bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-sm md:text-base">
              А
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium">Администратор</div>
              <div className="text-xs text-muted-foreground">Администратор</div>
            </div>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Права доступа</h1>
            <p className="text-sm md:text-base text-muted-foreground">Управление ролями и разрешениями</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingRole(null);
              setFormData({
                name: '',
                description: '',
                permission_ids: [],
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
                <Icon name="Plus" size={18} />
                <span>Добавить роль</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRole ? 'Редактировать роль' : 'Новая роль'}</DialogTitle>
                <DialogDescription>
                  {editingRole ? 'Измените настройки роли и права доступа' : 'Создайте новую роль и назначьте права доступа'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название роли *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Администратор"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Полный доступ ко всем функциям"
                  />
                </div>

                <div className="space-y-3 border-t border-white/10 pt-4">
                  <h4 className="text-sm font-semibold">Права доступа</h4>
                  {Object.entries(groupedPermissions).map(([resource, perms]) => (
                    <div key={resource} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${getResourceColor(resource)}`}>
                          <Icon name={getResourceIcon(resource)} size={14} />
                        </div>
                        <h5 className="text-sm font-medium capitalize">{resource}</h5>
                      </div>
                      <div className="ml-8 space-y-2">
                        {perms.map((perm) => (
                          <div key={perm.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`perm-${perm.id}`}
                              checked={formData.permission_ids.includes(perm.id)}
                              onCheckedChange={() => togglePermission(perm.id)}
                            />
                            <Label htmlFor={`perm-${perm.id}`} className="text-sm cursor-pointer">
                              {perm.description}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button type="submit" className="w-full">
                  {editingRole ? 'Сохранить изменения' : 'Создать роль'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {roles.map((role) => (
              <Card key={role.id} className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-1">{role.name}</h3>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <Icon name="Shield" size={24} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
                    <Icon name="Users" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {role.user_count} {role.user_count === 1 ? 'пользователь' : 'пользователей'}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                      Разрешения ({role.permissions?.length || 0})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {role.permissions?.slice(0, 6).map((perm) => (
                        <div
                          key={perm.id}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${getResourceColor(perm.resource)}`}
                        >
                          <Icon name={getResourceIcon(perm.resource)} size={12} />
                          <span>{perm.action}</span>
                        </div>
                      ))}
                      {(role.permissions?.length || 0) > 6 && (
                        <div className="inline-flex items-center px-2 py-1 rounded-lg text-xs bg-white/5 text-muted-foreground">
                          +{(role.permissions?.length || 0) - 6}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-white/10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(role)}
                      className="flex-1 gap-2"
                    >
                      <Icon name="Pencil" size={16} />
                      Редактировать
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(role.id)}
                      className="gap-2 text-red-500 hover:text-red-600"
                    >
                      <Icon name="Trash2" size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Roles;