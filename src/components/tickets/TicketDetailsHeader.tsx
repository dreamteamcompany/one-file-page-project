import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface Ticket {
  id: number;
  title: string;
  category_name?: string;
  category_icon?: string;
  status_name?: string;
  status_color?: string;
}

interface TicketDetailsHeaderProps {
  ticket: Ticket;
}

const TicketDetailsHeader = ({ ticket }: TicketDetailsHeaderProps) => {
  return (
    <div className="flex items-center gap-3">
      {ticket.category_icon && (
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name={ticket.category_icon} size={20} className="text-primary" />
        </div>
      )}
      <span className="flex-1 text-lg font-semibold">{ticket.title}</span>
      {ticket.status_name && (
        <Badge
          variant="secondary"
          style={{ 
            backgroundColor: `${ticket.status_color}20`,
            color: ticket.status_color,
            borderColor: ticket.status_color
          }}
        >
          {ticket.status_name}
        </Badge>
      )}
    </div>
  );
};

export default TicketDetailsHeader;
