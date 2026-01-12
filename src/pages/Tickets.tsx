import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketsData } from '@/hooks/useTicketsData';
import { useTicketForm } from '@/hooks/useTicketForm';
import { useSidebarTouch } from '@/hooks/useSidebarTouch';
import { useBulkTicketActions } from '@/hooks/useBulkTicketActions';
import { useToast } from '@/hooks/use-toast';
import TicketsSidebar from '@/components/tickets/TicketsSidebar';
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
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
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
    menuOpen,
    setMenuOpen,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSidebarTouch();

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
    <div className="flex min-h-screen">
      <TicketsSidebar
        menuOpen={menuOpen}
        dictionariesOpen={dictionariesOpen}
        setDictionariesOpen={setDictionariesOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
      />

      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="flex-1 lg:ml-[250px] p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <TicketsHeader
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
          />

          <TicketsSearch searchQuery={searchQuery} onSearchChange={setSearchQuery} />

          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="flex items-center gap-2"
              >
                <Icon name="List" size={16} />
                Список
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="flex items-center gap-2"
              >
                <Icon name="LayoutGrid" size={16} />
                Канбан
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
                className="flex items-center gap-2"
              >
                <Icon name="CheckSquare" size={16} />
                {bulkMode ? 'Отменить выбор' : 'Массовые действия'}
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
                      const response = await fetch('https://functions.poehali.dev/744488c0-48b7-46cc-8ea8-bb3fc43c2d76', {
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
                      const response = await fetch('https://functions.poehali.dev/744488c0-48b7-46cc-8ea8-bb3fc43c2d76', {
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
                      const response = await fetch('https://functions.poehali.dev/744488c0-48b7-46cc-8ea8-bb3fc43c2d76', {
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
      </main>
    </div>
  );
};

export default Tickets;