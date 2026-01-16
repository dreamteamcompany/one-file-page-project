import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketsData } from '@/hooks/useTicketsData';
import { useTicketForm } from '@/hooks/useTicketForm';
import { useBulkTicketActions } from '@/hooks/useBulkTicketActions';
import { useToast } from '@/hooks/use-toast';
import PageLayout from '@/components/layout/PageLayout';
import AppHeader from '@/components/layout/AppHeader';
import TicketsHeader from '@/components/tickets/TicketsHeader';
import TicketsSearch from '@/components/tickets/TicketsSearch';
import TicketForm from '@/components/tickets/TicketForm';
import TicketsList from '@/components/tickets/TicketsList';
import TicketsKanban from '@/components/tickets/TicketsKanban';
import BulkActionsBar from '@/components/tickets/BulkActionsBar';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

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
  service_id?: number;
  service_name?: string;
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
  unread_comments?: number;
  has_response?: boolean;
}

const Tickets = () => {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [bulkMode, setBulkMode] = useState(false);

  const {
    tickets,
    categories,
    priorities,
    statuses,
    departments,
    customFields,
    services,
    ticketServices,
    loading,
    loadTickets,
    loadDictionaries,
    loadServices,
  } = useTicketsData();

  const handleFormOpen = () => {
    loadDictionaries();
    loadServices();
  };

  const {
    dialogOpen,
    setDialogOpen,
    formData,
    setFormData,
    handleSubmit,
  } = useTicketForm(customFields, loadTickets);

  const {
    selectedTicketIds,
    selectedCount,
    toggleTicketSelection,
    toggleAllTickets,
    clearSelection,
    isTicketSelected,
  } = useBulkTicketActions();

  const filteredTickets = tickets.filter(ticket => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        ticket.title.toLowerCase().includes(query) ||
        ticket.description?.toLowerCase().includes(query) ||
        ticket.category_name?.toLowerCase().includes(query) ||
        ticket.priority_name?.toLowerCase().includes(query) ||
        ticket.department_name?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }
    return true;
  });

  return (
    <PageLayout>
      <AppHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      
      <div className="max-w-7xl mx-auto">
        <TicketsSearch searchQuery={searchQuery} onSearchChange={setSearchQuery} />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="flex items-center gap-2"
              >
                <Icon name="List" size={16} className="hidden sm:inline" />
                <span className="hidden sm:inline">Список</span>
                <Icon name="List" size={16} className="sm:hidden" />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="flex items-center gap-2"
              >
                <Icon name="LayoutGrid" size={16} className="hidden sm:inline" />
                <span className="hidden sm:inline">Канбан</span>
                <Icon name="LayoutGrid" size={16} className="sm:hidden" />
              </Button>
            </div>

            {viewMode === 'list' && (
              <Button
                variant={bulkMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setBulkMode(!bulkMode);
                  if (bulkMode) clearSelection();
                }}
                className="flex items-center gap-2 text-sm sm:text-base"
              >
                <Icon name="CheckSquare" size={16} />
                <span className="hidden sm:inline">{bulkMode ? 'Отменить выбор' : 'Массовые действия'}</span>
                <span className="sm:hidden">{bulkMode ? 'Отмена' : 'Массовые'}</span>
              </Button>
            )}
          </div>

          <TicketForm
            dialogOpen={dialogOpen}
            setDialogOpen={setDialogOpen}
            formData={formData}
            setFormData={setFormData}
            categories={categories}
            priorities={priorities}
            statuses={statuses}
            departments={departments}
            customFields={customFields}
            services={services}
            ticketServices={ticketServices}
            handleSubmit={handleSubmit}
            onDialogOpen={handleFormOpen}
          />

          {viewMode === 'list' ? (
            <div className="mt-6">
              <TicketsList
                tickets={filteredTickets}
                loading={loading}
                onTicketClick={(ticket) => navigate(`/tickets/${ticket.id}`, { state: { ticket } })}
                selectedTicketIds={selectedTicketIds}
                onToggleTicket={toggleTicketSelection}
                onToggleAll={toggleAllTickets}
                bulkMode={bulkMode}
                currentUserId={user?.id}
              />
              
              {bulkMode && selectedCount > 0 && (
                <BulkActionsBar
                  selectedCount={selectedCount}
                  statuses={statuses}
                  priorities={priorities}
                  onChangeStatus={async (statusId) => {
                    try {
                      const response = await fetch('https://functions.poehali.dev/582ca427-5c6d-4995-b1b5-f4f206c12a07', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'X-Auth-Token': token,
                        },
                        body: JSON.stringify({
                          ticket_ids: selectedTicketIds,
                          action: 'change_status',
                          status_id: statusId,
                        }),
                      });
                      
                      const result = await response.json();
                      
                      if (response.ok) {
                        toast({
                          title: 'Статус изменён',
                          description: `Обновлено ${result.successful} из ${result.total} заявок`,
                        });
                        loadTickets();
                        clearSelection();
                      } else {
                        throw new Error(result.error || 'Ошибка изменения статуса');
                      }
                    } catch (error) {
                      toast({
                        title: 'Ошибка',
                        description: error instanceof Error ? error.message : 'Не удалось изменить статус',
                        variant: 'destructive',
                      });
                    }
                  }}
                  onChangePriority={async (priorityId) => {
                    try {
                      const response = await fetch('https://functions.poehali.dev/582ca427-5c6d-4995-b1b5-f4f206c12a07', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'X-Auth-Token': token,
                        },
                        body: JSON.stringify({
                          ticket_ids: selectedTicketIds,
                          action: 'change_priority',
                          priority_id: priorityId,
                        }),
                      });
                      
                      const result = await response.json();
                      
                      if (response.ok) {
                        toast({
                          title: 'Приоритет изменён',
                          description: `Обновлено ${result.successful} из ${result.total} заявок`,
                        });
                        loadTickets();
                        clearSelection();
                      } else {
                        throw new Error(result.error || 'Ошибка изменения приоритета');
                      }
                    } catch (error) {
                      toast({
                        title: 'Ошибка',
                        description: error instanceof Error ? error.message : 'Не удалось изменить приоритет',
                        variant: 'destructive',
                      });
                    }
                  }}
                  onDelete={async () => {
                    try {
                      const response = await fetch('https://functions.poehali.dev/582ca427-5c6d-4995-b1b5-f4f206c12a07', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'X-Auth-Token': token,
                        },
                        body: JSON.stringify({
                          ticket_ids: selectedTicketIds,
                          action: 'delete',
                        }),
                      });
                      
                      const result = await response.json();
                      
                      if (response.ok) {
                        toast({
                          title: 'Заявки удалены',
                          description: `Удалено ${result.successful} из ${result.total} заявок`,
                        });
                        loadTickets();
                        clearSelection();
                      } else {
                        throw new Error(result.error || 'Ошибка удаления');
                      }
                    } catch (error) {
                      toast({
                        title: 'Ошибка',
                        description: error instanceof Error ? error.message : 'Не удалось удалить заявки',
                        variant: 'destructive',
                      });
                    }
                  }}
                  onCancel={() => {
                    clearSelection();
                    setBulkMode(false);
                  }}
                />
              )}
            </div>
          ) : (
            <TicketsKanban
              tickets={filteredTickets}
              statuses={statuses}
              loading={loading}
              onUpdateStatus={async (ticketId, statusId) => {
                try {
                  const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
                  await fetch(`${mainUrl}?endpoint=tickets-api`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Auth-Token': token,
                    },
                    body: JSON.stringify({ ticket_id: ticketId, status_id: statusId }),
                  });
                  loadTickets();
                } catch (error) {
                  console.error('Error updating status:', error);
                }
              }}
            />
          )}
      </div>
    </PageLayout>
  );
};

export default Tickets;