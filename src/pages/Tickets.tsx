/**
 * Страница управления заявками
 * Рефакторинг: разделено по Single Responsibility Principle
 * - Поиск вынесен в useTicketsSearch
 * - Режим просмотра в useTicketsView
 * - Bulk операции в useBulkTicketOperations
 * - UI переключения в TicketsViewToggle
 */
import InterfaceSwitcher from '@/components/tickets/InterfaceSwitcher';
import PageLayout from '@/components/layout/PageLayout';
import AppHeader from '@/components/layout/AppHeader';
import { useTicketsPage } from './tickets/useTicketsPage';
import TicketsWorkspaceView from './tickets/TicketsWorkspaceView';
import TicketsClassicView from './tickets/TicketsClassicView';

const Tickets = () => {
  const page = useTicketsPage();

  if (!page.canViewTickets) {
    return null;
  }

  return (
    <PageLayout menuOpen={page.menuOpen} setMenuOpen={page.setMenuOpen}>
      <AppHeader
        menuOpen={page.menuOpen}
        setMenuOpen={page.setMenuOpen}
        actions={<InterfaceSwitcher value={page.ticketsInterface} onChange={page.setInterface} />}
      />

      <div className="w-full flex flex-col flex-1">
        {page.ticketsInterface === 'workspace' ? (
          <TicketsWorkspaceView page={page} />
        ) : (
          <TicketsClassicView page={page} />
        )}
      </div>

      <footer className="mt-auto pt-8 py-4 text-center text-xs text-muted-foreground border-t border-border/40">
        © 2026 Команда Мечты
      </footer>
    </PageLayout>
  );
};

export default Tickets;
