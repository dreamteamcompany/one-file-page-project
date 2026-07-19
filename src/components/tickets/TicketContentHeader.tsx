import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Ticket } from './TicketDetailsContent.types';

interface TicketContentHeaderProps {
  ticket: Ticket;
  canEditContent: boolean;
  onOpenEdit: () => void;
  deadlineInfo: { color: string; label: string } | null;
  formatDate: (dateString?: string) => string;
  headerSlot?: React.ReactNode;
}

const TicketContentHeader = ({
  ticket,
  canEditContent,
  onOpenEdit,
  deadlineInfo,
  formatDate,
  headerSlot,
}: TicketContentHeaderProps) => {
  return (
    <div className="flex-1 min-w-0">
      {headerSlot && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {headerSlot}
        </div>
      )}
      <div className="flex items-start gap-2 mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex-1 min-w-0 break-words">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-base font-semibold mr-2 align-middle">#{ticket.id}</span>{ticket.title}
        </h1>
        {canEditContent && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Редактировать содержание"
            onClick={onOpenEdit}
          >
            <Icon name="Pencil" size={16} />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm">
        {ticket.due_date && deadlineInfo && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Дедлайн</span>
            <div className="flex items-center gap-2">
              <Icon name="Clock" size={16} style={{ color: deadlineInfo.color }} />
              <span style={{ color: deadlineInfo.color }} className="font-medium">{deadlineInfo.label}</span>
            </div>
          </div>
        )}
        {ticket.created_at && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Дата создания</span>
            <div className="flex items-center gap-2">
              <Icon name="Calendar" size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">{formatDate(ticket.created_at)}</span>
            </div>
          </div>
        )}
        {ticket.creator_name && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Заказчик</span>
            <div className="flex items-center gap-2">
              {ticket.creator_photo_url ? (
                <img src={ticket.creator_photo_url} alt={ticket.creator_name} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <Icon name="User" size={16} className="text-muted-foreground" />
              )}
              <span className="font-medium text-foreground">{ticket.creator_name}</span>
            </div>
            {ticket.creator_department_name && (
              <div className="flex items-center gap-2 mt-0.5">
                <Icon name="Building2" size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">{ticket.creator_department_name}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketContentHeader;