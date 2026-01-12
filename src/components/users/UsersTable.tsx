import { Button } from '@/components/ui/button';
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

interface UsersTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onToggleStatus: (userId: number, currentStatus: boolean) => void;
  onDelete: (userId: number, userName: string) => void;
}

const UsersTable = ({ users, onEdit, onToggleStatus, onDelete }: UsersTableProps) => {
  return (
    <>
      {/* Desktop version */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Пользователь</th>
            <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Должность</th>
            <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Роли</th>
            <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Последний вход</th>
            <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Статус</th>
            <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="p-4">
                <div className="flex items-center gap-3">
                  {user.photo_url ? (
                    <img 
                      src={user.photo_url} 
                      alt={user.full_name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {user.full_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{user.full_name || 'Без имени'}</div>
                    <div className="text-sm text-muted-foreground">@{user.username}</div>
                  </div>
                </div>
              </td>
              <td className="p-4 text-muted-foreground">{user.position || '—'}</td>
              <td className="p-4">
                <div className="flex flex-wrap gap-2">
                  {user.roles?.map((role) => (
                    <span key={role.id} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">
                      {role.name}
                    </span>
                  )) || <span className="text-muted-foreground text-xs">Нет ролей</span>}
                </div>
              </td>
              <td className="p-4 text-muted-foreground text-sm">
                {user.last_login 
                  ? new Date(user.last_login).toLocaleDateString('ru-RU')
                  : 'Никогда'
                }
              </td>
              <td className="p-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  user.is_active 
                    ? 'bg-green-500/10 text-green-500' 
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  {user.is_active ? 'Активен' : 'Заблокирован'}
                </span>
              </td>
              <td className="p-4">
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(user)}
                    className="gap-2 text-blue-500 hover:text-blue-600"
                  >
                    <Icon name="Pencil" size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleStatus(user.id, user.is_active)}
                    className={`gap-2 ${user.is_active ? 'text-yellow-500 hover:text-yellow-600' : 'text-green-500 hover:text-green-600'}`}
                  >
                    <Icon name={user.is_active ? 'Ban' : 'Check'} size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(user.id, user.full_name)}
                    className="gap-2 text-red-500 hover:text-red-600"
                  >
                    <Icon name="Trash2" size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Mobile version */}
      <div className="md:hidden space-y-3">
        {users.map((user) => (
          <div key={user.id} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                {user.photo_url ? (
                  <img 
                    src={user.photo_url} 
                    alt={user.full_name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    {user.full_name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.full_name || 'Без имени'}</div>
                  <div className="text-sm text-muted-foreground truncate">@{user.username}</div>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                user.is_active 
                  ? 'bg-green-500/10 text-green-500' 
                  : 'bg-red-500/10 text-red-500'
              }`}>
                {user.is_active ? 'Активен' : 'Заблокирован'}
              </span>
            </div>

            {user.position && (
              <div className="text-sm">
                <span className="text-muted-foreground/70">Должность: </span>
                <span className="text-muted-foreground">{user.position}</span>
              </div>
            )}

            {user.roles && user.roles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <span key={role.id} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">
                    {role.name}
                  </span>
                ))}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Последний вход: {user.last_login 
                ? new Date(user.last_login).toLocaleDateString('ru-RU')
                : 'Никогда'
              }
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(user)}
                className="flex-1 gap-2 text-blue-500 hover:text-blue-600"
              >
                <Icon name="Pencil" size={16} />
                <span>Изменить</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleStatus(user.id, user.is_active)}
                className={`flex-1 gap-2 ${user.is_active ? 'text-yellow-500 hover:text-yellow-600' : 'text-green-500 hover:text-green-600'}`}
              >
                <Icon name={user.is_active ? 'Ban' : 'Check'} size={16} />
                <span>{user.is_active ? 'Блок' : 'Актив'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(user.id, user.full_name)}
                className="gap-2 text-red-500 hover:text-red-600"
              >
                <Icon name="Trash2" size={16} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default UsersTable;