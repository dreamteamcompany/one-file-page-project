import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UPLOAD_FILE_URL } from '@/utils/api';
import DepartmentCombobox from '@/components/users/DepartmentCombobox';
import SubordinatesSelector from '@/components/users/SubordinatesSelector';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

interface UserFormDialogProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  editingUser: User | null;
  setEditingUser: (user: User | null) => void;
  formData: {
    username: string;
    password: string;
    full_name: string;
    position: string;
    role_ids: number[];
    photo_url: string;
    email: string;
    bitrix_user_id: string;
    max_user_id: string;
    department_id?: number | null;
    is_active?: boolean;
    subordinate_department_ids?: number[];
    subordinate_user_ids?: number[];
  };
  setFormData: (data: Record<string, string | number[] | boolean | number | null>) => void;
  roles: Role[];
  rolesError?: boolean;
  onRetryRoles?: () => void;
  departments?: Department[];
  allUsers?: { id: number; full_name: string; username?: string }[];
  handleSubmit: (e: React.FormEvent) => void;
  canCreate?: boolean;
  onToggleStatus?: (userId: number, currentStatus: boolean) => void;
  onToggleBypassDepartmentHead?: (userId: number, currentValue: boolean) => void;
}

const UserFormDialog = ({
  dialogOpen,
  setDialogOpen,
  editingUser,
  setEditingUser,
  formData,
  setFormData,
  roles,
  rolesError = false,
  onRetryRoles,
  departments = [],
  allUsers = [],
  handleSubmit,
  canCreate = true,
  onToggleStatus,
  onToggleBypassDepartmentHead,
}: UserFormDialogProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Ошибка',
        description: 'Файл слишком большой. Максимум 5 МБ',
        variant: 'destructive',
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ошибка',
        description: 'Можно загружать только изображения',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];

        const response = await fetch(UPLOAD_FILE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: base64Data,
            filename: file.name,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setFormData({ ...formData, photo_url: data.url });
          toast({
            title: 'Успешно',
            description: 'Фото загружено',
          });
        } else {
          throw new Error('Upload failed');
        }
      } catch (err) {
        console.error('Failed to upload photo:', err);
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить фото',
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      setDialogOpen(open);
      if (!open) {
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
      }
    }}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
          <Icon name="UserPlus" size={18} />
          <span>Добавить пользователя</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[720px] w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}</DialogTitle>
          <DialogDescription>
            {editingUser ? 'Измените данные пользователя' : 'Создайте нового пользователя системы'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Фото профиля</Label>
            <div className="flex items-center gap-4">
              {formData.photo_url ? (
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border">
                  <img src={formData.photo_url} alt="Фото профиля" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, photo_url: '' })}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Icon name="Trash2" size={20} className="text-white" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-accent/30 border-2 border-border flex items-center justify-center">
                  <Icon name="User" size={32} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 w-full"
                >
                  <Icon name="Upload" size={14} />
                  {uploading ? 'Загрузка...' : 'Выбрать фото'}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG или GIF, до 5 МБ</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Логин</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">Полное имя</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Иван Иванов"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Должность</Label>
            <Input
              id="position"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              placeholder="Менеджер"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Отдел</Label>
            <DepartmentCombobox
              departments={departments}
              value={formData.department_id ?? null}
              onChange={(departmentId) => setFormData({ ...formData, department_id: departmentId })}
            />
            <p className="text-xs text-muted-foreground">
              Подтягивается автоматически из Битрикс24, можно изменить вручную
            </p>
          </div>
          <div className="space-y-2 rounded-md border border-border p-3 bg-accent/20">
            <Label>Мои подчинённые</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Выберите отделы или конкретных сотрудников. Их заявки будут видны этому руководителю
              в разделе «Заявки сотрудников» (без уведомлений).
            </p>
            <SubordinatesSelector
              departments={departments}
              users={allUsers}
              currentUserId={editingUser?.id}
              selectedDepartmentIds={formData.subordinate_department_ids ?? []}
              selectedUserIds={formData.subordinate_user_ids ?? []}
              onChangeDepartments={(ids) => setFormData({ ...formData, subordinate_department_ids: ids })}
              onChangeUsers={(ids) => setFormData({ ...formData, subordinate_user_ids: ids })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@company.ru"
            />
            <p className="text-xs text-muted-foreground">
              Используется для привязки к аккаунту Битрикс24
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_user_id">MAX ID</Label>
            <Input
              id="max_user_id"
              value={formData.max_user_id}
              onChange={(e) => setFormData({ ...formData, max_user_id: e.target.value })}
              placeholder="12345"
            />
            <p className="text-xs text-muted-foreground">
              ID пользователя в мессенджере MAX для уведомлений от бота
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bitrix_user_id">Битрикс ID</Label>
            <Input
              id="bitrix_user_id"
              value={formData.bitrix_user_id}
              onChange={(e) => setFormData({ ...formData, bitrix_user_id: e.target.value })}
              placeholder="12345"
            />
            <p className="text-xs text-muted-foreground">
              ID пользователя в Битрикс24 (приоритетнее email при входе)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{editingUser ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required={!editingUser}
              minLength={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Роли</Label>
            <div className="space-y-2 border border-border rounded-md p-3 bg-accent/30">
              {rolesError ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-destructive">Не удалось загрузить роли</p>
                  {onRetryRoles && (
                    <Button type="button" size="sm" variant="outline" onClick={onRetryRoles} className="gap-1">
                      <Icon name="RefreshCw" size={14} />
                      Повторить
                    </Button>
                  )}
                </div>
              ) : !roles || roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Загрузка ролей...</p>
              ) : (
                roles.map((role) => (
                  <div key={role.id} className="flex items-start gap-3 p-2 rounded hover:bg-accent/50 transition-colors">
                    <input
                      type="checkbox"
                      id={`role-${role.id}`}
                      checked={formData.role_ids.includes(role.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, role_ids: [...formData.role_ids, role.id] });
                        } else {
                          setFormData({ ...formData, role_ids: formData.role_ids.filter(id => id !== role.id) });
                        }
                      }}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="flex-1 cursor-pointer" onClick={() => {
                      const checkbox = document.getElementById(`role-${role.id}`) as HTMLInputElement;
                      checkbox?.click();
                    }}>
                      <Label htmlFor={`role-${role.id}`} className="cursor-pointer font-medium">{role.name}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {editingUser && onToggleStatus && (
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-accent/30">
              <div className="flex-1 mr-3">
                <Label className="font-medium">Статус учётной записи</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingUser.is_active ? 'Пользователь активен и может входить в систему' : 'Учётная запись отключена, вход заблокирован'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggleStatus(editingUser.id, editingUser.is_active);
                  setDialogOpen(false);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  editingUser.is_active ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    editingUser.is_active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
          {editingUser && onToggleBypassDepartmentHead && (
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-accent/30">
              <div className="flex-1 mr-3">
                <Label className="font-medium">Вход через Битрикс без руководства</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingUser.bypass_department_head_check
                    ? 'Пользователь может входить через Битрикс, даже если не является руководителем отдела'
                    : 'Вход через Битрикс только при наличии должности руководителя отдела'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggleBypassDepartmentHead(editingUser.id, !!editingUser.bypass_department_head_check);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  editingUser.bypass_department_head_check ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    editingUser.bypass_department_head_check ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
          <Button type="submit" className="w-full">
            {editingUser ? 'Сохранить изменения' : 'Создать пользователя'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserFormDialog;