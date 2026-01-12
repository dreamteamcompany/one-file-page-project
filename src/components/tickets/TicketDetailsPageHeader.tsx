import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface Ticket {
  id: number;
  title: string;
  status_name?: string;
  status_color?: string;
  priority_name?: string;
  creator_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface TicketDetailsPageHeaderProps {
  ticket: Ticket;
  onBack: () => void;
}

const TicketDetailsPageHeader = ({ ticket, onBack }: TicketDetailsPageHeaderProps) => {
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

  return (
    <div className="bg-[#3C5468] border-b border-gray-600">
      <div className="px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="text-white/80 hover:text-white"
          >
            <Icon name="Home" className="w-5 h-5" />
          </button>
          <Icon name="ChevronRight" className="w-4 h-4 text-white/60" />
          <span className="text-white/80 text-sm">Заявки</span>
          <Icon name="ChevronRight" className="w-4 h-4 text-white/60" />
          <span className="text-white text-sm">#{ticket.id}</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <h1 className="text-xl text-white font-medium">
              #{ticket.id} {ticket.title}
            </h1>
            <div className="flex gap-2">
              <Badge 
                className="rounded px-2 py-1"
                style={{
                  backgroundColor: ticket.status_color || '#6b7280',
                  color: 'white'
                }}
              >
                {ticket.status_name || 'Завершено'}
              </Badge>
              <Badge variant="destructive" className="rounded px-2 py-1">
                {ticket.priority_name || 'Низкий'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-3 text-sm text-white/70">
          <div className="flex items-center gap-2">
            <Icon name="User" className="w-4 h-4" />
            <span>{ticket.creator_name || 'Кузнецов А. С.'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Создано: {formatDateTime(ticket.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Дедлайн: {formatDateTime(ticket.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsPageHeader;
