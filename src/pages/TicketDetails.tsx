import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/layout/PageLayout';
import { useTicketDetailsPage } from './ticket-details/useTicketDetailsPage';
import TicketDetailsHeader from './ticket-details/TicketDetailsHeader';
import TicketDetailsBody from './ticket-details/TicketDetailsBody';
import TicketDetailsDialogs from './ticket-details/TicketDetailsDialogs';

const TicketDetails = () => {
  const page = useTicketDetailsPage();

  if (!page.canViewTickets) {
    return null;
  }

  if (page.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icon name="Loader2" size={48} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!page.ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Icon name="FileQuestion" size={64} className="text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground mb-4">Тикет не найден</p>
        <Button onClick={() => page.navigate('/tickets')}>Вернуться к списку</Button>
      </div>
    );
  }

  return (
    <PageLayout menuOpen={page.menuOpen} setMenuOpen={page.setMenuOpen} forceCollapsed>
      <TicketDetailsHeader page={page} />

      <TicketDetailsBody page={page} />

      <footer className="mt-auto pt-6 py-4 text-center text-xs text-muted-foreground border-t border-border/40">
        © 2026 Команда Мечты
      </footer>

      <TicketDetailsDialogs page={page} />
    </PageLayout>
  );
};

export default TicketDetails;
