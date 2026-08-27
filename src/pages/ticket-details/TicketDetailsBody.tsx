import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import TicketDetailsContent from '@/components/tickets/TicketDetailsContent';
import TicketDetailsSidebar from '@/components/tickets/TicketDetailsSidebar';
import ReopenTicketButton from '@/components/tickets/ReopenTicketButton';
import type { useTicketDetailsPage } from './useTicketDetailsPage';

interface Props {
  page: ReturnType<typeof useTicketDetailsPage>;
}

const TicketDetailsBody = ({ page: p }: Props) => {
  const ticket = p.ticket!;

  return (
    <div className="flex-1 overflow-auto -mx-4 md:-mx-6 lg:-mx-[30px] px-4 md:px-6 lg:px-[30px] -mb-4 md:-mb-6 lg:-mb-[30px] pb-4 md:pb-6 lg:pb-[30px]">
      <div className="w-full py-2">
        <div className="flex flex-col lg:grid lg:[grid-template-columns:auto_1fr] gap-6 lg:items-stretch">
        <div className="hidden lg:block">
          <TicketDetailsSidebar 
            ticket={ticket}
            statuses={p.statuses}
            users={p.users}
            executorUsers={p.executorUsers}
            updating={p.updating || p.isClosed}
            sendingPing={p.sendingPing}
            statusError={p.statusError}
            isCustomer={ticket.created_by === p.user?.id}
            hasAssignee={!!ticket.assigned_to}
            executorGroups={p.executorGroups}
            onUpdateStatus={(statusId) => p.lockedHandleUpdateStatus(Number(statusId))}
            onAssignUser={p.lockedHandleAssignUser}
            onAssignGroup={p.lockedHandleAssignGroup}
            onSendPing={p.lockedHandleSendPing}
            onApprovalChange={p.loadTicket}
            onUpdateDueDate={p.isClosed ? undefined : p.lockedHandleUpdateDueDate}
            onReopened={p.loadTicket}
            hidePing={p.isClosed || p.needsCreatorConfirmation}
          />
        </div>

        <div className="lg:hidden w-full space-y-2">
          <button
            type="button"
            onClick={() => p.setSidebarOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-[#1b254b]/50 border border-border text-foreground text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <Icon name="Info" size={16} />
              Информация о заявке
            </span>
            <Icon
              name="ChevronDown"
              size={16}
              className={`transition-transform duration-200 ${p.sidebarOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <div
            ref={p.sidebarRef}
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: p.sidebarOpen ? p.sidebarRef.current?.scrollHeight + 'px' : '0px',
              opacity: p.sidebarOpen ? 1 : 0,
            }}
          >
            <div className="pt-3">
              <TicketDetailsSidebar 
                ticket={ticket}
                statuses={p.statuses}
                users={p.users}
                executorUsers={p.executorUsers}
                updating={p.updating || p.isClosed}
                sendingPing={p.sendingPing}
                isCustomer={ticket.created_by === p.user?.id}
                hasAssignee={!!ticket.assigned_to}
                executorGroups={p.executorGroups}
                onUpdateStatus={(statusId) => p.lockedHandleUpdateStatus(Number(statusId))}
                onAssignUser={p.lockedHandleAssignUser}
                onAssignGroup={p.lockedHandleAssignGroup}
                onSendPing={p.lockedHandleSendPing}
                onApprovalChange={p.loadTicket}
                onUpdateDueDate={p.isClosed ? undefined : p.lockedHandleUpdateDueDate}
                onReopened={p.loadTicket}
                hidePing
              />
            </div>
          </div>
        </div>



        {!p.isClosed && !p.needsCreatorConfirmation && (
          <div className="lg:hidden w-full">
            <Button
              onClick={p.lockedHandleSendPing}
              disabled={p.sendingPing}
              size="lg"
              className="w-full font-semibold bg-orange-500 hover:bg-orange-600 text-white"
            >
              {p.sendingPing ? (
                <>
                  <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                  Отправка запроса...
                </>
              ) : (
                <>
                  <Icon name="Bell" size={18} className="mr-2" />
                  Запросить статус
                </>
              )}
            </Button>
          </div>
        )}

        <div className="min-w-0 lg:min-h-0 lg:flex lg:flex-col">
          <TicketDetailsContent
              ticket={ticket}
              comments={p.comments}
              loadingComments={p.loadingComments}
              newComment={p.newComment}
              submittingComment={p.submittingComment}
              sendingPing={p.sendingPing}
              userId={p.user?.id}
              commentIsInternal={p.commentIsInternal}
              onToggleCommentInternal={p.setCommentIsInternal}
              onCommentChange={p.setNewComment}
              onSubmitComment={p.lockedHandleSubmitComment}
              onSendPing={p.lockedHandleSendPing}
              onReaction={p.lockedHandleReaction}
              onTogglePin={p.lockedHandleTogglePin}
              onDeleteComment={p.lockedHandleDeleteComment}
              onEditComment={p.lockedHandleEditComment}
              canDeleteComments={p.isAdmin}
              canEditComments={p.isAdmin}
              availableUsers={p.users}
              onFileUpload={p.handleFileUpload}
              uploadingFile={p.uploadingFile}
              pendingAttachments={p.pendingAttachments}
              onRemoveAttachment={p.removeAttachment}
              auditLogs={p.auditLogs}
              loadingHistory={p.loadingHistory}
              commentsBlocked={p.isClosed || (p.isReopened && !!p.isAssignee) || p.needsCreatorConfirmation}
              commentsBlockedMessage={
                p.needsCreatorConfirmation
                  ? 'Сначала подтвердите или отклоните решение исполнителя — после этого комментарии снова станут доступны.'
                  : p.isClosed
                  ? 'Заявка закрыта. Откройте её повторно, чтобы оставлять комментарии.'
                  : 'Заявка открыта повторно. Для работы с ней необходимо сначала принять её в работу, изменив статус.'
              }
              participantIds={p.participantIds}
              myLastSeenAt={p.myLastSeenAt}
              onMarkRead={p.markCommentsRead}
              onUpdateContent={p.isClosed ? undefined : p.lockedHandleUpdateContent}
              updating={p.updating || p.isClosed}
              headerSlot={
                p.isClosed ? (
                  <ReopenTicketButton ticketId={ticket.id} onReopened={p.loadTicket} />
                ) : null
              }
            />
        </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsBody;
