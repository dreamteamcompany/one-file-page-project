import TicketsSearchBar from '@/components/tickets/TicketsSearchBar';
import TicketsViewToggle from '@/components/tickets/TicketsViewToggle';
import TicketCountersBar from '@/components/tickets/TicketCountersBar';
import TicketForm from '@/components/tickets/TicketForm';
import TicketsList from '@/components/tickets/TicketsList';
import TicketsKanban from '@/components/tickets/TicketsKanban';
import BulkActionsBar from '@/components/tickets/BulkActionsBar';
import { apiFetch } from '@/utils/api';
import type { TicketsFiltersValue } from '@/components/tickets/TicketsFilters';
import { SORT_OPTIONS } from './ticketsPageUtils';
import type { useTicketsPage } from './useTicketsPage';

interface Props {
  page: ReturnType<typeof useTicketsPage>;
}

const TicketsClassicView = ({ page: p }: Props) => (
  <>
    <TicketsViewToggle
      viewMode={p.viewMode}
      onViewModeChange={p.setViewMode}
      bulkMode={p.bulkMode}
      onBulkModeToggle={p.handleBulkModeToggle}
      showArchived={p.showArchived}
      onToggleArchived={p.toggleArchived}
      showHidden={p.showHidden}
      onToggleHidden={p.toggleHidden}
      hiddenCount={p.hiddenCount}
      hideWaiting={p.hideWaiting}
      onToggleHideWaiting={p.toggleHideWaiting}
      showAll={p.showAll}
      onToggleShowAll={p.toggleShowAll}
      showWatching={p.showWatching}
      onToggleWatching={p.toggleWatching}
      showSubordinates={p.showSubordinates}
      hasSubordinates={p.hasSubordinates}
      onToggleSubordinates={p.toggleSubordinates}
      canBulkActions={p.canBulkActions}
    />


      <TicketCountersBar activeRole={p.counterRole} onSelectRole={p.setCounterRole} />

      {!p.showArchived && !p.showHidden && <div className="w-fit mt-3">
        <TicketForm
          dialogOpen={p.dialogOpen}
          setDialogOpen={p.setDialogOpen}
          formData={p.formData}
          setFormData={p.setFormData}
          categories={p.categories}
          priorities={p.priorities}
          statuses={p.statuses}
          departments={p.departments}
          customFields={p.customFields}
          services={p.services}
          ticketServices={p.ticketServices}
          handleSubmit={p.handleSubmit}
          onDialogOpen={p.handleFormOpen}
          canCreate={p.hasPermission('tickets', 'create')}
        />
      </div>}

      <div className="sticky top-0 z-20 mt-4 sm:mt-6 bg-[#0f1535]/95 [.light_&]:bg-[#f3f3f9]/95 backdrop-blur-sm py-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-[30px] lg:px-[30px]">
        <TicketsSearchBar
          searchQuery={p.searchQuery}
          onSearchChange={p.setSearchQuery}
          sortBy={p.sortBy}
          onSortByChange={p.handleSortByChange}
          sortDir={p.sortDir}
          onSortDirToggle={p.handleSortDirToggle}
          sortOptions={SORT_OPTIONS}
          filtersValue={p.searchFilters as TicketsFiltersValue}
          onFiltersChange={p.handleFiltersChange}
          filterOptions={p.filterOptions}
          showControls={p.viewMode === 'list'}
        />
      </div>

      {p.viewMode === 'list' ? (
        <div className="mt-4">
          <TicketsList
            tickets={p.filteredTickets}
            loading={p.loading}
            onTicketClick={(ticket) => window.open(`${window.location.origin}/tickets/${ticket.id}`, '_blank', 'noopener')}
            selectedTicketIds={p.selectedTicketIds}
            onToggleTicket={p.toggleTicketSelection}
            onToggleAll={p.toggleAllTickets}
            bulkMode={p.bulkMode}
            currentUserId={p.user?.id}
            page={p.page}
            totalPages={p.totalPages}
            totalTickets={p.totalTickets}
            onPageChange={(pg) => p.loadTickets(pg)}
            pageSize={p.pageSize}
            pageSizeOptions={p.pageSizeOptions}
            onPageSizeChange={p.changePageSize}
          />
          
          {p.bulkMode && p.selectedCount > 0 && (
            <BulkActionsBar
              selectedCount={p.selectedCount}
              statuses={p.statuses}
              priorities={p.priorities}
              users={p.bulkUsers}
              executorGroups={p.bulkExecutorGroups}
              isAdmin={p.isAdmin}
              onChangeStatus={p.handleChangeStatus}
              onChangePriority={p.handleChangePriority}
              onChangeExecutor={p.handleChangeExecutor}
              onChangeExecutorGroup={p.handleChangeExecutorGroup}
              onAddWatchers={p.handleAddWatchers}
              onDelete={p.handleDelete}
              onCancel={() => {
                p.clearSelection();
                p.disableBulkMode();
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
        <TicketsKanban
          tickets={p.filteredTickets}
          statuses={p.statuses}
          loading={p.loading}
          onUpdateStatus={async (ticketId, statusId) => {
            try {
              await apiFetch('/tickets', {
                method: 'PUT',
                body: JSON.stringify({ id: ticketId, status_id: statusId }),
              });
              p.loadTickets();
            } catch (error) {
              console.error('Error updating status:', error);
            }
          }}
        />
        </div>
      )}
  </>
);

export default TicketsClassicView;
