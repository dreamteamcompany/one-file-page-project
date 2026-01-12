import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TicketApprovalBlock from './TicketApprovalBlock';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Status {
  id: number;
  name: string;
  color: string;
  is_closed: boolean;
}

interface Ticket {
  id: number;
  title: string;
  description?: string;
  category_name?: string;
  category_icon?: string;
  priority_id?: number;
  priority_name?: string;
  priority_color?: string;
  status_id?: number;
  status_name?: string;
  status_color?: string;
  department_name?: string;
  created_by: number;
  creator_name?: string;
  creator_email?: string;
  assigned_to?: number;
  assignee_name?: string;
  assignee_email?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
}

interface TicketDetailsSidebarProps {
  ticket: Ticket;
  statuses: Status[];
  users: User[];
  updating: boolean;
  sendingPing?: boolean;
  isCustomer?: boolean;
  hasAssignee?: boolean;
  onUpdateStatus: (statusId: string) => void;
  onAssignUser: (userId: string) => void;
  onSendPing?: () => void;
  onApprovalChange?: () => void;
  onUpdateDueDate?: (dueDate: string | null) => void;
}

const TicketDetailsSidebar = ({
  ticket,
  statuses,
  users,
  updating,
  sendingPing = false,
  isCustomer = false,
  hasAssignee = false,
  onUpdateStatus,
  onAssignUser,
  onSendPing,
  onApprovalChange,
  onUpdateDueDate,
}: TicketDetailsSidebarProps) => {
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [dueDateValue, setDueDateValue] = useState(ticket.due_date || '');
  const getDeadlineInfo = (dueDate?: string) => {
    if (!dueDate) return null;
    
    const now = new Date().getTime();
    const due = new Date(dueDate).getTime();
    const timeLeft = due - now;
    
    if (timeLeft < 0) {
      return { color: '#ef4444', label: 'Просрочена', urgent: true };
    }
    
    const oneDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil(timeLeft / oneDay);
    
    if (daysLeft <= 1) {
      return { color: '#ef4444', label: `Остался ${daysLeft} день`, urgent: true };
    } else if (daysLeft <= 3) {
      return { color: '#f97316', label: `Осталось ${daysLeft} дня`, urgent: true };
    } else if (daysLeft <= 7) {
      return { color: '#eab308', label: `Осталось ${daysLeft} дней`, urgent: false };
    } else {
      return { color: '#22c55e', label: `Осталось ${daysLeft} дней`, urgent: false };
    }
  };

  const deadlineInfo = getDeadlineInfo(ticket.due_date);

  return (
    <div className="w-full lg:w-[400px] space-y-3 flex-shrink-0">
      {onSendPing && (
        <div className="p-4 rounded-lg border-2 border-orange-500">
          <Button
            onClick={onSendPing}
            disabled={sendingPing}
            size="lg"
            className="w-full font-semibold bg-orange-500 hover:bg-orange-600 text-white"
          >
            {sendingPing ? (
              <>
                <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                Отправка запроса...
              </>
            ) : (
              <>
                <Icon name="Bell" size={18} className="mr-2" />
                Запросить статус
              </>
            )}
          </Button>
          <p className="text-xs text-orange-700 dark:text-orange-400 mt-2 text-center">
            Уведомить исполнителя о необходимости обновить статус
          </p>
        </div>
      )}
      
      <div className="p-3 rounded-lg bg-background border">
        <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="CheckCircle" size={14} />
          Статус
        </h3>
        <Select
          value={ticket.status_id?.toString()}
          onValueChange={onUpdateStatus}
          disabled={updating}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите статус" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status.id} value={status.id.toString()}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  {status.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TicketApprovalBlock
        ticketId={ticket.id}
        statusName={ticket.status_name || ''}
        onStatusChange={onApprovalChange || (() => {})}
        availableUsers={users}
      />

      {ticket.creator_name && (
        <div className="p-3 rounded-lg bg-background border">
          <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Icon name="User" size={14} />
            Заказчик
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Icon name="User" size={16} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{ticket.creator_name}</p>
              {ticket.creator_email && (
                <p className="text-xs text-muted-foreground truncate">{ticket.creator_email}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-3 rounded-lg bg-background border">
        <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="UserCheck" size={14} />
          Исполнитель
        </h3>
        <Select
          value={ticket.assigned_to?.toString() || 'unassign'}
          onValueChange={onAssignUser}
          disabled={updating}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите исполнителя" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassign">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon name="UserX" size={14} />
                Не назначен
              </div>
            </SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id.toString()}>
                <div className="flex flex-col">
                  <span className="text-sm">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(ticket.due_date || isCustomer) && (
        <div className="p-3 rounded-lg border" style={deadlineInfo ? { 
          backgroundColor: `${deadlineInfo.color}10`,
          borderColor: deadlineInfo.color
        } : {}}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Icon name="Calendar" size={14} />
              Дедлайн
            </h3>
            {isCustomer && onUpdateDueDate && (
              <button
                onClick={() => {
                  setIsEditingDueDate(!isEditingDueDate);
                  if (!isEditingDueDate) {
                    setDueDateValue(ticket.due_date || '');
                  }
                }}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Icon name={isEditingDueDate ? 'X' : 'Edit'} size={12} />
                {isEditingDueDate ? 'Отмена' : 'Изменить'}
              </button>
            )}
          </div>
          
          {isEditingDueDate ? (
            <div className="space-y-2">
              <input
                type="date"
                value={dueDateValue}
                onChange={(e) => setDueDateValue(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background text-foreground"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    onUpdateDueDate(dueDateValue || null);
                    setIsEditingDueDate(false);
                  }}
                  className="flex-1"
                >
                  Сохранить
                </Button>
                {ticket.due_date && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onUpdateDueDate(null);
                      setDueDateValue('');
                      setIsEditingDueDate(false);
                    }}
                  >
                    <Icon name="Trash2" size={14} />
                  </Button>
                )}
              </div>
            </div>
          ) : ticket.due_date && deadlineInfo ? (
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ 
                backgroundColor: `${deadlineInfo.color}20`
              }}>
                <Icon name={deadlineInfo.urgent ? 'AlertCircle' : 'Clock'} size={16} style={{ color: deadlineInfo.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm mb-0.5" style={{ color: deadlineInfo.color }}>
                  {deadlineInfo.label}
                </p>
                <p className="text-xs" style={{ color: deadlineInfo.color, opacity: 0.75 }}>
                  {new Date(ticket.due_date).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              {deadlineInfo.urgent && (
                <Badge 
                  variant="secondary"
                  className="flex-shrink-0"
                  style={{ 
                    backgroundColor: deadlineInfo.color,
                    color: 'white',
                    fontSize: '10px',
                    padding: '2px 6px'
                  }}
                >
                  Срочно
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Не установлен</p>
          )}
        </div>
      )}

      {ticket.category_name && (
        <div className="p-3 rounded-lg bg-background border">
          <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Icon name="Tag" size={14} />
            Категория
          </h3>
          <div className="flex items-center gap-2">
            {ticket.category_icon && (
              <Icon name={ticket.category_icon} size={14} className="text-primary" />
            )}
            <p className="text-sm">{ticket.category_name}</p>
          </div>
        </div>
      )}

      {ticket.priority_name && (
        <div className="p-3 rounded-lg border bg-background">
          <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Icon name="Flag" size={14} />
            Приоритет
          </h3>
          <div className="flex items-center gap-2">
            <Badge
              style={{ 
                backgroundColor: `${ticket.priority_color}20`,
                color: ticket.priority_color,
                borderColor: ticket.priority_color
              }}
              className="border"
            >
              {ticket.priority_name}
            </Badge>
          </div>
        </div>
      )}

      {ticket.department_name && (
        <div className="p-3 rounded-lg bg-background border">
          <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Icon name="Building2" size={14} />
            Департамент
          </h3>
          <p className="text-sm">{ticket.department_name}</p>
        </div>
      )}

      {ticket.created_at && (
        <div className="p-3 rounded-lg bg-background border">
          <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Icon name="Calendar" size={14} />
            Создана
          </h3>
          <p className="text-xs text-muted-foreground">
            {new Date(ticket.created_at).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      )}
    </div>
  );
};

export default TicketDetailsSidebar;