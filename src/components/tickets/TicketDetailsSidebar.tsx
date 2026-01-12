import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface User {
  id: number;
  name: string;
  email: string;
}

interface Status {
  id: number;
  name: string;
  color: string;
  order: number;
}

interface Ticket {
  id: number;
  title: string;
  category_name?: string;
  status_id?: number;
  status_name?: string;
  status_color?: string;
  created_by: number;
  creator_name?: string;
  creator_email?: string;
  assigned_to?: number;
  assignee_name?: string;
  assignee_email?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface TicketDetailsSidebarProps {
  ticket: Ticket;
  statuses: Status[];
  users: User[];
  onUpdateStatus: (statusId: number) => void;
  updating: boolean;
}

const TicketDetailsSidebar = ({
  ticket,
  statuses,
  users,
  onUpdateStatus,
  updating,
}: TicketDetailsSidebarProps) => {
  const formatDateTime = (date?: string) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getWorkTime = () => {
    if (!ticket.created_at) return '00:00:00';
    
    const created = new Date(ticket.created_at);
    const now = ticket.updated_at ? new Date(ticket.updated_at) : new Date();
    const diff = now.getTime() - created.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-[360px] flex-shrink-0 space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="w-32 h-32 rounded-full border-4 border-blue-500 flex items-center justify-center mb-4">
            <div className="text-center">
              <Icon name="Clock" className="w-8 h-8 text-blue-500 mx-auto mb-1" />
              <div className="text-xs text-muted-foreground">Время выполнения</div>
            </div>
          </div>
          <div className="text-3xl font-bold">{getWorkTime()}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="Star" className="w-4 h-4 text-yellow-400" />
          <Icon name="Star" className="w-4 h-4 text-yellow-400" />
          <Icon name="Star" className="w-4 h-4 text-yellow-400" />
          <Icon name="Star" className="w-4 h-4 text-yellow-400" />
          <Icon name="Star" className="w-4 h-4 text-yellow-400" />
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Канал</span>
            <span className="font-medium flex items-center gap-1">
              <Icon name="Edit" className="w-3 h-3 text-blue-500" />
              Вручную
            </span>
          </div>

          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Начало работ (план)</span>
            <span className="font-medium">{formatDateTime(ticket.created_at)}</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Окончание работ (план)</span>
            <span className="font-medium">{formatDateTime(ticket.due_date || ticket.updated_at)}</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Начало работ (факт)</span>
            <span className="font-medium">{formatDateTime(ticket.created_at)}</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Окончание работ (факт)</span>
            <span className="font-medium">{formatDateTime(ticket.updated_at)}</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Категория</span>
            <span className="font-medium text-blue-500 underline cursor-pointer">
              {ticket.category_name || 'Заявка на обслуживание'}
            </span>
          </div>

          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Сервис</span>
            <span className="font-medium">{ticket.category_name || 'Учетные записи / Создание нового сотрудника'}</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Конфигурационные единицы</span>
            <span className="font-medium text-red-500">Не задано</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Наблюдатели</span>
            <span className="font-medium text-red-500">Не задано</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b">
            <span className="text-muted-foreground">Создатель</span>
            <span className="font-medium">{ticket.creator_name || 'Неизвестно'}</span>
          </div>

          <div className="flex items-start justify-between py-2">
            <span className="text-muted-foreground">Исполнитель</span>
            <span className="font-medium">{ticket.assignee_name || 'Первая линия поддержки / Администраторы'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsSidebar;
