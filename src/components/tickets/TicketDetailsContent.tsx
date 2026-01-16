import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TicketComments from '@/components/tickets/TicketComments';
import TicketHistory from '@/components/tickets/TicketHistory';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
}

interface Ticket {
  id: number;
  title: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
  priority_id?: number;
  priority_name?: string;
  priority_color?: string;
  status_id?: number;
  status_name?: string;
  status_color?: string;
  department_id?: number;
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
  custom_fields?: CustomField[];
}

interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  comment: string;
  is_internal: boolean;
  created_at?: string;
  attachments?: {
    id: number;
    filename: string;
    url: string;
    size: number;
  }[];
  reactions?: {
    emoji: string;
    count: number;
    users: number[];
  }[];
}

interface AuditLog {
  id: number;
  action: string;
  username: string;
  changed_fields?: any;
  old_values?: any;
  new_values?: any;
  metadata?: any;
  created_at: string;
}

interface TicketDetailsContentProps {
  ticket: Ticket;
  comments: Comment[];
  loadingComments: boolean;
  newComment: string;
  submittingComment: boolean;
  sendingPing: boolean;
  userId?: number;
  onCommentChange: (value: string) => void;
  onSubmitComment: (parentCommentId?: number, mentionedUserIds?: number[]) => void;
  onSendPing: () => void;
  onReaction: (commentId: number, emoji: string) => void;
  availableUsers?: Array<{id: number; name: string; email: string}>;
  onFileUpload?: (file: File) => Promise<void>;
  uploadingFile?: boolean;
  auditLogs?: AuditLog[];
  loadingHistory?: boolean;
}

const TicketDetailsContent = ({
  ticket,
  comments,
  loadingComments,
  newComment,
  submittingComment,
  sendingPing,
  userId,
  onCommentChange,
  onSubmitComment,
  onSendPing,
  onReaction,
  availableUsers,
  onFileUpload,
  uploadingFile,
  auditLogs = [],
  loadingHistory = false,
}: TicketDetailsContentProps) => {
  const [activeTab, setActiveTab] = useState<'comments' | 'files' | 'history'>('comments');
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDeadlineInfo = (dueDate?: string) => {
    if (!dueDate) return null;
    
    const now = new Date().getTime();
    const due = new Date(dueDate).getTime();
    const timeLeft = due - now;
    
    if (timeLeft < 0) {
      return { color: '#ef4444', label: 'Просрочена' };
    }
    
    const oneDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil(timeLeft / oneDay);
    
    if (daysLeft <= 1) {
      return { color: '#ef4444', label: `Остался ${daysLeft} день` };
    } else if (daysLeft <= 3) {
      return { color: '#f97316', label: `Осталось ${daysLeft} дня` };
    }
    return { color: '#22c55e', label: `Осталось ${daysLeft} дней` };
  };

  const deadlineInfo = getDeadlineInfo(ticket.due_date);

  return (
    <div className="flex-1 p-4 lg:p-6">
      {/* Суть заявки */}
      <div className="mb-6 border rounded-lg p-6 bg-card h-fit">
        {/* Тема */}
        <h1 className="text-2xl font-bold text-foreground mb-6">{ticket.title}</h1>
        
        {/* Заказчик, Дата создания, Дедлайн */}
        <div className="flex flex-wrap items-center gap-6 mb-6 text-sm">
          {ticket.creator_name && (
            <div className="flex items-center gap-2">
              <Icon name="User" size={16} className="text-muted-foreground" />
              <span className="font-medium text-foreground">{ticket.creator_name}</span>
            </div>
          )}
          
          {ticket.created_at && (
            <div className="flex items-center gap-2">
              <Icon name="Calendar" size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">{formatDate(ticket.created_at)}</span>
            </div>
          )}
          
          {ticket.due_date && deadlineInfo && (
            <div className="flex items-center gap-2">
              <Icon name="Clock" size={16} style={{ color: deadlineInfo.color }} />
              <span style={{ color: deadlineInfo.color }} className="font-medium">{deadlineInfo.label}</span>
            </div>
          )}
        </div>
        
        {/* Статус и Приоритет */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {ticket.status_name && (
            <Badge
              style={{ 
                backgroundColor: `${ticket.status_color}20`,
                color: ticket.status_color,
                borderColor: ticket.status_color
              }}
              className="border font-medium"
            >
              {ticket.status_name}
            </Badge>
          )}
          
          {ticket.priority_name && (
            <Badge
              style={{ 
                backgroundColor: `${ticket.priority_color}20`,
                color: ticket.priority_color,
                borderColor: ticket.priority_color
              }}
              className="border font-medium"
            >
              {ticket.priority_name}
            </Badge>
          )}
        </div>
        
        {/* Кнопки действий */}
        <div className="flex flex-wrap items-center gap-2 mb-6 pb-6 border-b">
          <Button variant="ghost" size="sm" title="Список заявок">
            <Icon name="List" size={18} />
          </Button>
          <Button variant="ghost" size="sm" title="Редактировать заявку">
            <Icon name="Edit" size={18} />
          </Button>
          <Button variant="ghost" size="sm" title="Добавить комментарий">
            <Icon name="MessageSquare" size={18} />
          </Button>
          <Button variant="ghost" size="sm" title="Копировать заявку">
            <Icon name="Copy" size={18} />
          </Button>
          <Button variant="ghost" size="sm" title="Наблюдатели">
            <Icon name="Eye" size={18} />
          </Button>
          <Button variant="ghost" size="sm" title="Поиск по базе знаний">
            <Icon name="Search" size={18} />
          </Button>
        </div>
        
        {/* Содержание заявки */}
        {ticket.description && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Содержание</h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{ticket.description}</p>
          </div>
        )}
      </div>

      {/* Комментарии, Файлы и История (вкладки) */}
      <div className="border-b mb-6">
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab('comments')}
            className={`pb-2 border-b-2 text-sm font-semibold transition-all ${
              activeTab === 'comments' 
                ? 'border-primary text-foreground' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Комментарии ({comments.length})
          </button>
          <button 
            onClick={() => setActiveTab('files')}
            className={`pb-2 border-b-2 text-sm transition-all ${
              activeTab === 'files' 
                ? 'border-primary text-foreground font-semibold' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Файлы (0)
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-2 border-b-2 text-sm transition-all ${
              activeTab === 'history' 
                ? 'border-primary text-foreground font-semibold' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            История ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="mb-6">
        {activeTab === 'comments' && (
          <TicketComments
            comments={comments}
            loadingComments={loadingComments}
            newComment={newComment}
            submittingComment={submittingComment}
            onCommentChange={onCommentChange}
            onSubmitComment={onSubmitComment}
            isCustomer={ticket.created_by === userId}
            hasAssignee={!!ticket.assigned_to}
            sendingPing={sendingPing}
            onSendPing={onSendPing}
            currentUserId={userId}
            onReaction={onReaction}
            availableUsers={availableUsers}
            onFileUpload={onFileUpload}
            uploadingFile={uploadingFile}
          />
        )}
        
        {activeTab === 'files' && (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="FileText" size={48} className="mx-auto mb-2 opacity-30" />
            <p>Файлы пока не загружены</p>
          </div>
        )}
        
        {activeTab === 'history' && (
          <TicketHistory 
            logs={auditLogs} 
            loading={loadingHistory}
          />
        )}
      </div>
    </div>
  );
};

export default TicketDetailsContent;