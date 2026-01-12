import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import TicketKanbanCard from './TicketKanbanCard';

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
  assigned_to?: number;
  assignee_name?: string;
  created_by?: number;
  due_date?: string;
  created_at?: string;
  has_response?: boolean;
}

interface Status {
  id: number;
  name: string;
  color: string;
  order: number;
}

interface TicketsKanbanProps {
  tickets: Ticket[];
  statuses: Status[];
  loading: boolean;
  onUpdateStatus: (ticketId: number, statusId: number) => void;
}

const TicketsKanban = ({ tickets, statuses, loading, onUpdateStatus }: TicketsKanbanProps) => {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order);

  const sortTickets = (tickets: Ticket[]) => {
    return [...tickets].sort((a, b) => {
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });
  };

  const getTicketsByStatus = (statusId: number) => {
    const filtered = tickets.filter(ticket => ticket.status_id === statusId);
    return sortTickets(filtered);
  };

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const ticketId = active.id as number;
      const newStatusId = over.id as number;
      
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket && ticket.status_id !== newStatusId) {
        onUpdateStatus(ticketId, newStatusId);
      }
    }
    
    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeTicket = tickets.find(t => t.id === activeId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="Loader2" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sortedStatuses.map((status) => {
          const statusTickets = getTicketsByStatus(status.id);
          
          return (
            <div
              key={status.id}
              className="flex-shrink-0 w-[320px] bg-muted/30 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <h3 className="font-semibold text-sm">{status.name}</h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {statusTickets.length}
                </Badge>
              </div>

              <SortableContext
                items={statusTickets.map(t => t.id)}
                strategy={verticalListSortingStrategy}
                id={status.id.toString()}
              >
                <div className="space-y-2 min-h-[200px]">
                  {statusTickets.map((ticket) => (
                    <TicketKanbanCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => navigate(`/tickets/${ticket.id}`, { state: { ticket } })}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTicket && (
          <div className="opacity-80">
            <TicketKanbanCard ticket={activeTicket} onClick={() => {}} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default TicketsKanban;