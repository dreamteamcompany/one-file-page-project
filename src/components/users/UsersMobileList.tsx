import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

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

interface UsersMobileListProps {
  users: User[];
  onEdit: (user: User) => void;
  onToggleStatus: (userId: number, currentStatus: boolean) => void;
  onDelete: (userId: number, userName: string) => void;
}

const UsersMobileList = ({ users, onEdit, onToggleStatus, onDelete }: UsersMobileListProps) => {
  return (
    <div className="md:hidden space-y-3 p-4">
      {users.map((user) => (
        <Card key={user.id} className="border-white/10 bg-white/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              {user.photo_url ? (
                <img 
                  src={user.photo_url} 
                  alt={user.full_name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {user.full_name.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium">{user.full_name || 'Без имени'}</div>
                <div className="text-sm text-muted-foreground">@{user.username}</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${
                user.is_active 
                  ? 'bg-green-500/10 text-green-500' 
                  : 'bg-red-500/10 text-red-500'
              }`}>
                {user.is_active ? 'Активен' : 'Заблокирован'}
              </span>
            </div>
            {user.position && (
              <div className="text-sm text-muted-foreground">Должность: {user.position}</div>
            )}
            <div className="flex flex-wrap gap-2">
              {user.roles?.map((role) => (
                <span key={role.id} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">
                  {role.name}
                </span>
              )) || <span className="text-muted-foreground text-xs">Нет ролей</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(user)}
                className="gap-2 text-blue-500 hover:text-blue-600 border-blue-500/50"
              >
                <Icon name="Pencil" size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleStatus(user.id, user.is_active)}
                className={`gap-2 ${user.is_active ? 'text-yellow-500 hover:text-yellow-600 border-yellow-500/50' : 'text-green-500 hover:text-green-600 border-green-500/50'}`}
              >
                <Icon name={user.is_active ? 'Ban' : 'Check'} size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(user.id, user.full_name)}
                className="gap-2 text-red-500 hover:text-red-600 border-red-500/50"
              >
                <Icon name="Trash2" size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default UsersMobileList;