import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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
  };
  setFormData: (data: any) => void;
  roles: Role[];
  handleSubmit: (e: React.FormEvent) => void;
}

const UserFormDialog = ({
  dialogOpen,
  setDialogOpen,
  editingUser,
  setEditingUser,
  formData,
  setFormData,
  roles,
  handleSubmit,
}: UserFormDialogProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

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
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];

        const response = await fetch('https://functions.poehali.dev/37368ef2-6990-44c6-9439-232d3a5820ff', {
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
      };
      reader.readAsDataURL(file);
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
        });
      }
    }}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
          <Icon name="UserPlus" size={18} />
          <span>Добавить пользователя</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
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
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white/10">
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
                <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center">
                  <Icon name="User" size={32} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {uploading ? 'Загрузка...' : 'JPG, PNG или GIF, до 5 МБ'}
                </p>
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
            <div className="space-y-2 border border-white/10 rounded-md p-3 bg-white/5">
              {!roles || roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Загрузка ролей...</p>
              ) : (
                roles.map((role) => (
                  <div key={role.id} className="flex items-start gap-3 p-2 rounded hover:bg-white/5 transition-colors">
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
          <Button type="submit" className="w-full">
            {editingUser ? 'Сохранить изменения' : 'Создать пользователя'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserFormDialog;