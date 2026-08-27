import ConfirmationOverlay from '@/components/tickets/ConfirmationOverlay';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import type { useTicketDetailsPage } from './useTicketDetailsPage';

interface Props {
  page: ReturnType<typeof useTicketDetailsPage>;
}

const TicketDetailsDialogs = ({ page: p }: Props) => (
  <>
    {p.confirmationMode && (
      <ConfirmationOverlay
        ticket={p.ticket!}
        initialMode={p.confirmationMode}
        onChanged={() => { p.setConfirmationMode(null); p.loadTicket(); }}
        onClose={() => p.setConfirmationMode(null)}
      />
    )}

    <AlertDialog open={!!p.watcherDialog} onOpenChange={(open) => { if (!open) p.setWatcherDialog(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Добавить в наблюдатели?</AlertDialogTitle>
          <AlertDialogDescription>
            Исполнитель <strong>{p.watcherDialog?.userName}</strong> был снят с заявки. Добавить его в наблюдатели, чтобы он видел дальнейшие обновления?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => p.setWatcherDialog(null)}>Нет</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (p.watcherDialog) p.handleAddWatcher(p.watcherDialog.userId);
              p.setWatcherDialog(null);
            }}
          >
            Добавить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);

export default TicketDetailsDialogs;
