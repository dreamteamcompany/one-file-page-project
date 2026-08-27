import TicketsWorkspace from '@/components/tickets/workspace/TicketsWorkspace';
import TicketForm from '@/components/tickets/TicketForm';
import BulkActionsBar from '@/components/tickets/BulkActionsBar';
import TicketsFilters, { TicketsFilterPanel, type TicketsFiltersValue } from '@/components/tickets/TicketsFilters';
import { SORT_OPTIONS } from './ticketsPageUtils';
import type { useTicketsPage } from './useTicketsPage';

interface Props {
  page: ReturnType<typeof useTicketsPage>;
}

const TicketsWorkspaceView = ({ page: p }: Props) => (
  <>
    <TicketsWorkspace
      tickets={p.filteredTickets}
      loading={p.loading}
      searchQuery={p.searchQuery}
      onSearchChange={p.setSearchQuery}
      currentUserId={p.user?.id}
      overdueCount={p.overdueCount}
      closedCount={p.closedCount}
      onReloadList={() => p.loadTickets(p.page)}
      filters={p.searchFilters as TicketsFiltersValue}
      onRemoveFilter={p.handleRemoveFilter}
      sortBy={p.sortBy}
      onSortByChange={p.handleSortByChange}
      sortDir={p.sortDir}
      onSortDirToggle={p.handleSortDirToggle}
      sortOptions={SORT_OPTIONS}
      bulkMode={p.canBulkActions}
      selectedTicketIds={p.selectedTicketIds}
      onToggleTicket={p.toggleTicketSelection}
      onToggleAll={p.toggleAllTickets}
      activeRole={p.workspaceActiveRole}
      onSelectRole={(role) => p.setCounterRole(role)}
      assignedCount={p.assignedToMeCount}
      canCreate={p.hasPermission('tickets', 'create')}
      onCreateTicket={p.handleCreateTicket}
      page={p.page}
      totalPages={p.totalPages}
      totalTickets={p.totalTickets}
      pageSize={p.pageSize}
      onPageChange={(pg) => p.loadTickets(pg)}
      onPageSizeChange={p.changePageSize}
      filtersSlot={
        <TicketsFilters
          value={p.searchFilters as TicketsFiltersValue}
          onChange={p.handleFiltersChange}
          compact
          expanded={p.filtersOpen}
          onExpandedChange={p.setFiltersOpen}
        />
      }
      filterPanelSlot={
        <TicketsFilterPanel
          value={p.searchFilters as TicketsFiltersValue}
          onChange={p.handleFiltersChange}
          expanded={p.filtersOpen}
          onExpandedChange={p.setFiltersOpen}
          options={p.filterOptions}
        />
      }
    />
    <div className="hidden">
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
        canCreate={false}
      />
    </div>
    {p.canBulkActions && p.selectedCount > 0 && (
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
        onCancel={p.clearSelection}
      />
    )}
  </>
);

export default TicketsWorkspaceView;
