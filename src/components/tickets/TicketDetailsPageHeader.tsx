import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface TicketDetailsPageHeaderProps {
  ticketId: number;
  onBack: () => void;
}

const TicketDetailsPageHeader = ({ ticketId, onBack }: TicketDetailsPageHeaderProps) => {
  return (
    <div className="border-b bg-muted/20 sticky top-0 z-10">
      <div className="container max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
          >
            <Icon name="ArrowLeft" size={16} className="mr-2" />
            Назад
          </Button>
          <h1 className="text-xl font-semibold">Запрос на обслуживание "{ticketId}"</h1>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsPageHeader;
