import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Ticket {
  id: number;
  title: string;
  description?: string;
  category_name?: string;
  category_icon?: string;
  priority_id?: number;
  priority_name?: string;
  priority_color?: string;
  department_name?: string;
  assigned_to?: number;
  assignee_name?: string;
  created_by?: number;
  due_date?: string;
  created_at?: string;
  has_response?: boolean;
}

interface TicketKanbanCardProps {
  ticket: Ticket;
  onClick: () => void;
  isDragging?: boolean;
}

const TicketKanbanCard = ({ ticket, onClick, isDragging = false }: TicketKanbanCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getDueDateInfo = (dueDate?: string) => {
    if (!dueDate) return null;
    
    const now = new Date().getTime();
    const due = new Date(dueDate).getTime();
    const timeLeft = due - now;
    
    if (timeLeft < 0) {
      return { color: '#ef4444', text: 'Просрочена', urgent: true };
    }
    
    const oneDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil(timeLeft / oneDay);
    
    if (daysLeft <= 1) {
      return { color: '#ef4444', text: `${daysLeft} день`, urgent: true };
    } else if (daysLeft <= 3) {
      return { color: '#f97316', text: `${daysLeft} дня`, urgent: true };
    }
    
    return null;
  };

  const dueDateInfo = getDueDateInfo(ticket.due_date);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        bg-background rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer border border-border
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <h4 className="font-semibold text-sm mb-2 line-clamp-2">{ticket.title}</h4>

      {ticket.description && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
          {ticket.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {ticket.category_name && (
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            {ticket.category_icon && <Icon name={ticket.category_icon} size={12} />}
            {ticket.category_name}
          </Badge>
        )}

        {ticket.priority_name && (
          <Badge
            style={{
              backgroundColor: `${ticket.priority_color}20`,
              color: ticket.priority_color,
              borderColor: ticket.priority_color
            }}
            className="text-xs border"
          >
            {ticket.priority_name}
          </Badge>
        )}

        {ticket.has_response && (
          <Badge variant="default" className="text-xs flex items-center gap-1 bg-blue-500">
            <Icon name="MessageSquareReply" size={12} />
            Ответ
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          {ticket.assignee_name ? (
            <>
              <Icon name="User" size={12} />
              <span className="truncate max-w-[120px]">{ticket.assignee_name}</span>
            </>
          ) : (
            <>
              <Icon name="UserX" size={12} />
              <span>Не назначен</span>
            </>
          )}
        </div>

        {ticket.created_at && (
          <span>
            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ru })}
          </span>
        )}
      </div>

      {dueDateInfo && (
        <div
          className="flex items-center gap-1 mt-2 pt-2 border-t text-xs font-semibold"
          style={{ color: dueDateInfo.color }}
        >
          <Icon name="Clock" size={12} />
          <span>{dueDateInfo.text}</span>
        </div>
      )}
    </div>
  );
};

export default TicketKanbanCard;