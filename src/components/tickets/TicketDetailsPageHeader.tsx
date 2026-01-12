import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface Ticket {
  id: number;
  title: string;
  status_name?: string;
  status_color?: string;
  priority_name?: string;
  priority_color?: string;
  creator_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface TicketDetailsPageHeaderProps {
  ticket: Ticket;
  onBack: () => void;
}

const TicketDetailsPageHeader = ({ ticket, onBack }: TicketDetailsPageHeaderProps) => {
  return (
    <div className="border-b bg-background sticky top-0 z-10">
      <div className="container max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <Icon name="ArrowLeft" size={16} className="mr-2" />
              Назад к заявкам
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold">#{ticket.id} {ticket.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              style={{
                backgroundColor: ticket.status_color || '#6b7280',
                color: 'white'
              }}
            >
              {ticket.status_name || 'Новая'}
            </Badge>
            {ticket.priority_name && (
              <Badge 
                style={{
                  backgroundColor: ticket.priority_color || '#ef4444',
                  color: 'white'
                }}
              >
                {ticket.priority_name}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsPageHeader;
