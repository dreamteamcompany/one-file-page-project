import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { TicketsListProps } from './TicketsListTypes';
import TicketCard from './TicketCard';
import TicketsListPagination from './TicketsListPagination';

const TicketsList = ({
  tickets,
  loading,
  onTicketClick,
  selectedTicketIds = [],
  onToggleTicket,
  onToggleAll,
  bulkMode = false,
  currentUserId: _currentUserId,
  page = 1,
  totalPages = 1,
  totalTickets = 0,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: TicketsListProps) => {
  const { hasSystemRole } = useAuth();
  const canCallPhone = hasSystemRole('admin', 'executor');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Загрузка заявок...</p>
        </div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Icon name="Ticket" size={32} className="text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">Нет заявок</h3>
            <p className="text-muted-foreground">
              Создайте первую заявку, нажав кнопку выше
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const sortedTickets = tickets;

  const allSelected = bulkMode && sortedTickets.length > 0 && sortedTickets.every(t => selectedTicketIds.includes(t.id));

  return (
    <div className="space-y-4">
      {bulkMode && sortedTickets.length > 0 && (
        <Card className="p-3 bg-muted/50">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => onToggleAll?.(sortedTickets.map(t => t.id), allSelected)}
            />
            <span className="text-sm font-medium">
              Выбрать все ({sortedTickets.length})
            </span>
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {sortedTickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            selectedTicketIds={selectedTicketIds}
            bulkMode={bulkMode}
            canCallPhone={canCallPhone}
            onToggleTicket={onToggleTicket}
            onTicketClick={onTicketClick}
          />
        ))}
      </div>

      <TicketsListPagination
        page={page}
        totalPages={totalPages}
        totalTickets={totalTickets}
        onPageChange={onPageChange}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
};

export default TicketsList;