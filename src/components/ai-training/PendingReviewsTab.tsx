import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { TicketService, Service } from './ExamplesTab';
import AddExistingTicketsDialog from './AddExistingTicketsDialog';
import PendingReviewItem from './PendingReviewItem';
import CorrectReviewDialog from './CorrectReviewDialog';
import { usePendingReviews } from './usePendingReviews';

export type { PendingReview } from './PendingReviewItem';

interface PendingReviewsTabProps {
  pendingReviews: import('./PendingReviewItem').PendingReview[];
  ticketServices: TicketService[];
  services: Service[];
  onReload: () => void;
}

const PendingReviewsTab = ({ pendingReviews, ticketServices, services, onReload }: PendingReviewsTabProps) => {
  const rv = usePendingReviews({ ticketServices, services, onReload });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">На проверку</CardTitle>
              <CardDescription className="text-xs mt-1">
                Результаты автоматической классификации, ожидающие проверки оператором.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <Button size="sm" variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => rv.setAddDialog(true)}>
                <Icon name="FilePlus" size={16} />
                Добавить заявки
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 flex-1 sm:flex-none"
                onClick={() => rv.recheckBulk('pending')}
                disabled={!!rv.bulkRecheck}
              >
                <Icon name={rv.bulkRecheck?.scope === 'pending' ? 'Loader2' : 'RefreshCw'} size={16} className={rv.bulkRecheck?.scope === 'pending' ? 'animate-spin' : ''} />
                {rv.bulkRecheck?.scope === 'pending' ? `Перепроверка ${rv.bulkRecheck.done}` : 'Перепроверить непроверенные'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 flex-1 sm:flex-none"
                onClick={() => rv.recheckBulk('all')}
                disabled={!!rv.bulkRecheck}
              >
                <Icon name={rv.bulkRecheck?.scope === 'all' ? 'Loader2' : 'RefreshCcwDot'} size={16} className={rv.bulkRecheck?.scope === 'all' ? 'animate-spin' : ''} />
                {rv.bulkRecheck?.scope === 'all' ? `Перепроверка ${rv.bulkRecheck.done}` : 'Перепроверить всё'}
              </Button>
              {pendingReviews.length > 0 && (
                <Button size="sm" className="gap-2 flex-1 sm:flex-none" onClick={rv.handleApproveAll} disabled={rv.loading}>
                  <Icon name="CheckCheck" size={16} />
                  Подтвердить все
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pendingReviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="CheckCircle" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Нет записей на проверку</p>
              <p className="text-xs mt-1">Новые классификации появятся здесь автоматически</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReviews.map(review => (
                <PendingReviewItem
                  key={review.id}
                  rv={review}
                  loading={rv.loading}
                  recheckingId={rv.recheckingId}
                  bulkRecheck={rv.bulkRecheck}
                  recheckOne={rv.recheckOne}
                  handleApprove={rv.handleApprove}
                  openCorrectDialog={rv.openCorrectDialog}
                  handleReject={rv.handleReject}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CorrectReviewDialog
        open={rv.correctDialog}
        onOpenChange={rv.setCorrectDialog}
        correctingReview={rv.correctingReview}
        correctForm={rv.correctForm}
        setCorrectForm={rv.setCorrectForm}
        ticketServices={ticketServices}
        filteredServices={rv.filteredServices}
        loading={rv.loading}
        toggleServiceId={rv.toggleServiceId}
        addQuestion={rv.addQuestion}
        updateQuestion={rv.updateQuestion}
        removeQuestion={rv.removeQuestion}
        handleCorrect={rv.handleCorrect}
      />

      <AddExistingTicketsDialog
        open={rv.addDialog}
        onOpenChange={rv.setAddDialog}
        onDone={onReload}
      />
    </>
  );
};

export default PendingReviewsTab;
