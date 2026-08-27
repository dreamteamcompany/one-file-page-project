import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import CreateAccountButton from '@/components/tickets/create-account/CreateAccountButton';
import type { useTicketDetailsPage } from './useTicketDetailsPage';

interface Props {
  page: ReturnType<typeof useTicketDetailsPage>;
}

const TicketDetailsHeader = ({ page: p }: Props) => (
  <>
    <div className="flex items-center gap-2 mb-1 -mt-4 md:-mt-3 lg:-mt-[18px]">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => p.setMenuOpen(!p.menuOpen)}
        className="lg:hidden shrink-0"
        title="Меню"
        aria-label="Меню"
      >
        <Icon name="Menu" size={24} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        data-back-button
        onClick={p.handleBack}
        className="shrink-0 w-9 h-9"
        title="Назад"
        aria-label="Назад"
      >
        <Icon name="ArrowLeft" size={20} />
      </Button>
      {p.hasPermission('account_automation', 'access') && (
        <div className="ml-auto shrink-0">
          <CreateAccountButton ticketId={p.ticket!.id} />
        </div>
      )}
    </div>

    {p.needsCreatorConfirmation && (
      <div data-confirmation-banner className="mb-4 rounded-xl border-2 border-orange-500 bg-orange-500/10 [.light_&]:bg-orange-100 [.light_&]:border-orange-500 p-4 relative overflow-hidden confirmation-banner-pulse">
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="shrink-0 w-12 h-12 rounded-full bg-orange-500/20 [.light_&]:bg-orange-500 flex items-center justify-center animate-bounce-slow">
            <Icon name="ClipboardCheck" size={24} className="text-orange-400 [.light_&]:text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-orange-400 [.light_&]:text-orange-700 uppercase tracking-wide">
              Требуется ваше решение
            </h3>
            <p className="text-xs text-muted-foreground [.light_&]:text-orange-900/80 mt-0.5">
              Исполнитель сообщает, что работа выполнена. Подтвердите или отклоните результат.
            </p>
          </div>
          <div className="shrink-0 flex gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white"
              onClick={() => p.setConfirmationMode('confirm')}
            >
              <Icon name="CheckCircle" size={14} className="mr-1" />
              Подтвердить
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none border-red-500/40 text-red-400 [.light_&]:text-red-600 [.light_&]:border-red-500 [.light_&]:bg-white hover:bg-red-500/10"
              onClick={() => p.setConfirmationMode('reject')}
            >
              <Icon name="XCircle" size={14} className="mr-1" />
              Отклонить
            </Button>
          </div>
        </div>
      </div>
    )}
  </>
);

export default TicketDetailsHeader;
