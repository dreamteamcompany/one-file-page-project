import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Ticket, getDeadlineProgress } from './TicketsListTypes';
import { parseServerDate, getDeadlineLeftLabel } from '@/utils/dateFormat';

const MSK_LIST_OPTS = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Moscow',
} as const;

interface TicketCardDesktopProps {
  ticket: Ticket;
}

const TicketCardDesktop = ({ ticket }: TicketCardDesktopProps) => {
  const deadline = ticket.due_date ? getDeadlineProgress(ticket.due_date) : null;

  const leftLabel = getDeadlineLeftLabel(ticket.due_date);

  return (
    <>
      {ticket.due_date && deadline && (
        <div className="hidden md:flex absolute inset-y-3 left-[76%] right-0 z-20 flex-col items-start justify-center gap-1.5 px-4 pointer-events-none border-l border-border">
          <span className="text-sm font-semibold truncate max-w-full" style={{ color: deadline.color }}>
            {deadline.label}
          </span>
          <div className="h-3 w-full flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = i < Math.round((deadline.percent / 100) * 5);
              return (
                <div
                  key={i}
                  className="flex-1 h-full rounded-sm transition-colors duration-300"
                  style={{ backgroundColor: filled ? deadline.color : 'hsl(var(--muted))' }}
                />
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-full">
            {leftLabel}
          </span>
        </div>
      )}

      <div className="hidden md:flex absolute inset-y-3 left-[63%] right-[24%] z-20 flex-col items-start justify-center gap-2 px-4 pointer-events-none border-l border-border">
        {ticket.created_at && (
          <div className="flex flex-col items-start gap-0.5 max-w-full">
            <span className="text-xs text-muted-foreground">Дата создания</span>
            <span className="inline-flex items-center gap-1.5 bg-muted text-foreground rounded-md px-2 py-1 text-xs max-w-full">
              <Icon name="Clock" size={11} className="flex-shrink-0" />
              <span className="truncate">
                {(parseServerDate(ticket.created_at) ?? new Date()).toLocaleString('ru-RU', MSK_LIST_OPTS)}
              </span>
            </span>
          </div>
        )}
        {ticket.due_date && (
          <div className="flex flex-col items-start gap-0.5 max-w-full">
            <span className="text-xs text-muted-foreground">Дедлайн</span>
            <span className="inline-flex items-center gap-1.5 bg-muted text-foreground rounded-md px-2 py-1 text-xs max-w-full">
              <Icon name="Calendar" size={11} className="flex-shrink-0" />
              <span className="truncate">
                {(parseServerDate(ticket.due_date) ?? new Date()).toLocaleString('ru-RU', MSK_LIST_OPTS)}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="hidden md:flex absolute inset-y-3 left-[50%] right-[37%] z-20 flex-col items-start justify-center gap-2 px-4 pointer-events-none border-l border-border">
        {ticket.status_name && (
          <div className="flex flex-col items-start gap-0.5 max-w-full">
            <span className="text-xs text-muted-foreground">Статус</span>
            <Badge
              variant="secondary"
              className="text-xs max-w-full truncate border"
              style={{
                backgroundColor: `${ticket.status_color}33`,
                color: ticket.status_color,
                borderColor: `${ticket.status_color}80`,
              }}
            >
              {ticket.status_name}
            </Badge>
          </div>
        )}
        {(ticket.customer_name || ticket.creator_name) && (
          <div className="flex flex-col items-start gap-0.5 max-w-full">
            <span className="text-xs text-muted-foreground">Заказчик</span>
            <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 rounded-md px-2 py-1 text-xs max-w-full">
              {ticket.creator_photo_url ? (
                <img src={ticket.creator_photo_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
              ) : (
                <Icon name="User" size={11} className="flex-shrink-0" />
              )}
              <span className="truncate">{ticket.customer_name || ticket.creator_name}</span>
            </span>
            {ticket.creator_department_name && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground max-w-full">
                <Icon name="Building2" size={11} className="flex-shrink-0" />
                <span className="truncate">{ticket.creator_department_name}</span>
              </span>
            )}
          </div>
        )}
        <div className="flex flex-col items-start gap-0.5 max-w-full">
          <span className="text-xs text-muted-foreground">Исполнитель</span>
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs leading-none max-w-full ${(ticket.assigned_to_name || ticket.assignee_name) ? 'bg-muted/60 text-muted-foreground' : 'bg-orange-500/10 text-orange-500'}`}>
            {ticket.assignee_photo_url ? (
              <img src={ticket.assignee_photo_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
            ) : (
              <Icon name={(ticket.assigned_to_name || ticket.assignee_name) ? "UserCheck" : "UserX"} size={11} className="block flex-shrink-0" />
            )}
            <span className="truncate leading-none">{ticket.assigned_to_name || ticket.assignee_name || 'Не назначен'}</span>
          </span>
        </div>
      </div>
    </>
  );
};

export default TicketCardDesktop;