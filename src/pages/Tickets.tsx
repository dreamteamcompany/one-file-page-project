/**
 * Страница управления заявками
 * Рефакторинг: разделено по Single Responsibility Principle
 * - Поиск вынесен в useTicketsSearch
 * - Режим просмотра в useTicketsView
 * - Bulk операции в useBulkTicketOperations
 * - UI переключения в TicketsViewToggle
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketsData } from '@/hooks/useTicketsData';
import { useTicketForm } from '@/hooks/useTicketForm';
import { useBulkTicketActions } from '@/hooks/useBulkTicketActions';
import { useTicketsSearch } from '@/hooks/useTicketsSearch';
import { useTicketsView } from '@/hooks/useTicketsView';
import { useBulkTicketOperations } from '@/hooks/useBulkTicketOperations';
import PageLayout from '@/components/layout/PageLayout';
import AppHeader from '@/components/layout/AppHeader';
import TicketsSearch from '@/components/tickets/TicketsSearch';
import TicketsViewToggle from '@/components/tickets/TicketsViewToggle';
import TicketForm from '@/components/tickets/TicketForm';
import TicketsList from '@/components/tickets/TicketsList';
import TicketsKanban from '@/components/tickets/TicketsKanban';
import BulkActionsBar from '@/components/tickets/BulkActionsBar';
import type { Ticket, CustomField } from '@/types';

const Tickets = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const { viewMode, setViewMode, bulkMode, toggleBulkMode, disableBulkMode } = useTicketsView();
  
  const filteredTickets = useTicketsSearch(tickets, searchQuery);

  const {
    selectedTicketIds,
    selectedCount,
    toggleTicketSelection,
    toggleAllTickets,
    clearSelection,
  } = useBulkTicketActions();

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
    handleChangeStatus,
    handleChangePriority,
    handleAssign,
    handleDelete,
  } = useBulkTicketOperations(selectedTicketIds, loadTickets, clearSelection);

  const handleBulkModeToggle = () => {
    toggleBulkMode();
    if (bulkMode) {
      clearSelection();
    }
  };

  return (
    <PageLayout>
      <AppHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      
      <div className="max-w-7xl mx-auto">
        <TicketsSearch searchQuery={searchQuery} onSearchChange={setSearchQuery} />

        <TicketsViewToggle
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          bulkMode={bulkMode}
          onBulkModeToggle={handleBulkModeToggle}
        />

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
                  onChangeStatus={handleChangeStatus}
                  onChangePriority={handleChangePriority}
                  onDelete={handleDelete}
                  onCancel={() => {
                    clearSelection();
                    disableBulkMode();
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