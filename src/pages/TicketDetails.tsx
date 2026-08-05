import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/layout/PageLayout';
import TicketDetailsContent from '@/components/tickets/TicketDetailsContent';
import TicketDetailsSidebar from '@/components/tickets/TicketDetailsSidebar';
import CreateAccountButton from '@/components/tickets/create-account/CreateAccountButton';
import ConfirmationOverlay from '@/components/tickets/ConfirmationOverlay';
import ReopenTicketButton from '@/components/tickets/ReopenTicketButton';
import { useTicketData } from '@/hooks/useTicketData';
import { useTicketActions } from '@/hooks/useTicketActions';
import { useTicketMarkRead } from '@/hooks/useTicketMarkRead';
import { useToast } from '@/hooks/use-toast';
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

const TicketDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmationMode, setConfirmationMode] = useState<'confirm' | 'reject' | null>(null);
  const [watcherDialog, setWatcherDialog] = useState<{ userId: number; userName: string } | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  const {
    ticket,
    statuses,
    comments,
    users,
    executorUsers,
    executorGroups,
    auditLogs,
    loading,
    loadingComments,
    loadingHistory,
    loadTicket,
    loadComments,
    loadHistory,
    participantIds,
    myLastSeenAt,
    markCommentsRead,
  } = useTicketData(id, location.state?.ticket || null);

  const {
    newComment,
    setNewComment,
    commentIsInternal,
    setCommentIsInternal,
    submittingComment,
    updating,
    sendingPing,
    uploadingFile,
    pendingAttachments,
    removeAttachment,
    handleSubmitComment,
    handleUpdateStatus,
    handleSendPing,
    handleReaction,
    handleTogglePin,
    handleDeleteComment,
    handleEditComment,
    handleFileUpload,
    handleAssignUser,
    handleAssignGroup,
    handleAddWatcher,
    handleUpdateDueDate,
    handleUpdateContent,
  } = useTicketActions(id, loadTicket, loadComments, loadHistory);

  const isAdmin = !!user?.roles?.some(
    (role) =>
      role.name === 'Администратор' ||
      role.name === 'Admin' ||
      role.name === 'admin' ||
      (role as { system_role?: string }).system_role === 'admin',
  );

  const { markRead } = useTicketMarkRead();

  useEffect(() => {
    if (id) {
      const tid = parseInt(id, 10);
      if (!Number.isNaN(tid) && tid > 0) {
        markRead(tid);
      }
    }
  }, [id, markRead]);

  const canViewTickets = hasPermission('tickets', 'view_all') || hasPermission('tickets', 'view_own_only');

  const isPendingConfirmation = useMemo(
    () => ticket?.status_is_pending_confirmation
      ?? !!statuses.find(s => s.id === ticket?.status_id)?.is_pending_confirmation,
    [statuses, ticket?.status_id, ticket?.status_is_pending_confirmation]
  );
  const isCreator = user?.id === ticket?.created_by;
  const isAssignee = user?.id === ticket?.assigned_to;
  const isReopened = useMemo(
    () => ticket?.status_is_reopened
      ?? !!statuses.find(s => s.id === ticket?.status_id)?.is_reopened,
    [statuses, ticket?.status_id, ticket?.status_is_reopened]
  );
  const isClosed = useMemo(
    () => ticket?.status_is_closed
      ?? !!statuses.find(s => s.id === ticket?.status_id)?.is_closed,
    [statuses, ticket?.status_id, ticket?.status_is_closed]
  );

  const showLockedToast = useCallback(() => {
    toast({
      title: 'Заявка закрыта',
      description: 'Откройте её повторно, чтобы вносить изменения.',
      variant: 'destructive',
    });
  }, [toast]);

  const lockedHandleUpdateStatus = useCallback((statusId: number) => {
    if (isClosed) { showLockedToast(); return; }
    return handleUpdateStatus(statusId);
  }, [isClosed, showLockedToast, handleUpdateStatus]);

  const lockedHandleAssignUser = useCallback((userId: string) => {
    if (isClosed) { showLockedToast(); return; }
    return handleAssignUser(userId);
  }, [isClosed, showLockedToast, handleAssignUser]);

  const lockedHandleAssignGroup = useCallback(async (groupId: string) => {
    if (isClosed) { showLockedToast(); return; }
    const currentAssignedTo = ticket?.assigned_to ?? null;
    const currentAssigneeName = ticket?.assignee_name ?? null;
    const { clearedAssignee } = await handleAssignGroup(groupId, currentAssignedTo);
    if (clearedAssignee && currentAssigneeName) {
      setWatcherDialog({ userId: clearedAssignee, userName: currentAssigneeName });
    }
  }, [isClosed, showLockedToast, handleAssignGroup, ticket?.assigned_to, ticket?.assignee_name]);

  const lockedHandleUpdateDueDate = useCallback((dueDate: string | null) => {
    if (isClosed) { showLockedToast(); return; }
    return handleUpdateDueDate(dueDate);
  }, [isClosed, showLockedToast, handleUpdateDueDate]);

  const lockedHandleSendPing = useCallback(() => {
    if (isClosed) { showLockedToast(); return; }
    return handleSendPing();
  }, [isClosed, showLockedToast, handleSendPing]);

  const lockedHandleSubmitComment = useCallback(
    (parentCommentId?: number, mentionedUserIds?: number[], overrideText?: string) => {
      if (isClosed) { showLockedToast(); return; }
      return handleSubmitComment(parentCommentId, mentionedUserIds, overrideText);
    },
    [isClosed, showLockedToast, handleSubmitComment]
  );

  const lockedHandleReaction = useCallback((commentId: number, emoji: string) => {
    if (isClosed) { showLockedToast(); return; }
    return handleReaction(commentId, emoji);
  }, [isClosed, showLockedToast, handleReaction]);

  const lockedHandleTogglePin = useCallback((commentId: number) => {
    if (isClosed) { showLockedToast(); return; }
    return handleTogglePin(commentId);
  }, [isClosed, showLockedToast, handleTogglePin]);

  const lockedHandleDeleteComment = useCallback((commentId: number) => {
    if (isClosed) { showLockedToast(); return; }
    return handleDeleteComment(commentId);
  }, [isClosed, showLockedToast, handleDeleteComment]);

  const lockedHandleEditComment = useCallback(
    (commentId: number, data: { comment?: string; created_at?: string }) => {
      if (isClosed) { showLockedToast(); return Promise.resolve(false); }
      return handleEditComment(commentId, data);
    },
    [isClosed, showLockedToast, handleEditComment]
  );

  const lockedHandleUpdateContent = useCallback(
    (payload: {
      title?: string;
      description?: string;
      custom_fields?: Record<string, string>;
      ticket_service_id?: number | null;
    }) => {
      if (isClosed) { showLockedToast(); return Promise.resolve(false); }
      return handleUpdateContent(payload);
    },
    [isClosed, showLockedToast, handleUpdateContent]
  );
  const needsCreatorConfirmation = isPendingConfirmation && isCreator;

  const handleBack = useCallback(() => {
    if (needsCreatorConfirmation) {
      setConfirmationMode('confirm');
    } else {
      navigate('/tickets');
    }
  }, [needsCreatorConfirmation, navigate]);

  useEffect(() => {
    if (!canViewTickets) {
      navigate('/tickets');
    }
  }, [canViewTickets, navigate]);

  useEffect(() => {
    if (!needsCreatorConfirmation) return;
    let ready = false;
    const timer = setTimeout(() => { ready = true; }, 300);
    const currentPath = window.location.pathname + window.location.search;

    const handlePopState = (e: PopStateEvent) => {
      if (!ready) return;
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      setConfirmationMode('confirm');
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (!ready) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // не мешаем взаимодействию внутри модалки подтверждения и самого баннера
      if (target.closest('[data-confirmation-overlay]') || target.closest('[data-confirmation-banner]')) {
        return;
      }

      // перехватываем только навигацию: ссылки, пункты меню и явную кнопку «Назад»
      const navEl = target.closest('a[href], [role="link"], [role="menuitem"], [data-back-button]') as HTMLElement | null;
      if (!navEl) return;

      // ссылка, ведущая на эту же страницу — пропускаем
      if (navEl.tagName === 'A') {
        const href = (navEl as HTMLAnchorElement).getAttribute('href') || '';
        if (!href || href.startsWith('#')) return;
        try {
          const url = new URL(href, window.location.origin);
          if (url.pathname + url.search === currentPath) return;
        } catch {
          /* относительный href — продолжаем перехват */
        }
      }

      e.preventDefault();
      e.stopPropagation();
      setConfirmationMode('confirm');
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClickCapture, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClickCapture, true);
    };
  }, [needsCreatorConfirmation]);

  if (!canViewTickets) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icon name="Loader2" size={48} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Icon name="FileQuestion" size={64} className="text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground mb-4">Тикет не найден</p>
        <Button onClick={() => navigate('/tickets')}>Вернуться к списку</Button>
      </div>
    );
  }

  return (
    <PageLayout menuOpen={menuOpen} setMenuOpen={setMenuOpen} forceCollapsed>
      <div className="flex items-center gap-2 mb-1 -mt-4 md:-mt-3 lg:-mt-[18px]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuOpen(!menuOpen)}
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
          onClick={handleBack}
          className="shrink-0 w-9 h-9"
          title="Назад"
          aria-label="Назад"
        >
          <Icon name="ArrowLeft" size={20} />
        </Button>
        {hasPermission('account_automation', 'access') && (
          <div className="ml-auto shrink-0">
            <CreateAccountButton ticketId={ticket.id} />
          </div>
        )}
      </div>

      {needsCreatorConfirmation && (
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
                onClick={() => setConfirmationMode('confirm')}
              >
                <Icon name="CheckCircle" size={14} className="mr-1" />
                Подтвердить
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none border-red-500/40 text-red-400 [.light_&]:text-red-600 [.light_&]:border-red-500 [.light_&]:bg-white hover:bg-red-500/10"
                onClick={() => setConfirmationMode('reject')}
              >
                <Icon name="XCircle" size={14} className="mr-1" />
                Отклонить
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto -mx-4 md:-mx-6 lg:-mx-[30px] px-4 md:px-6 lg:px-[30px] -mb-4 md:-mb-6 lg:-mb-[30px] pb-4 md:pb-6 lg:pb-[30px]">
        <div className="w-full py-2">
          <div className="flex flex-col lg:grid lg:[grid-template-columns:auto_1fr] gap-6 lg:items-stretch">
          <div className="hidden lg:block">
            <TicketDetailsSidebar 
              ticket={ticket}
              statuses={statuses}
              users={users}
              executorUsers={executorUsers}
              updating={updating || isClosed}
              sendingPing={sendingPing}
              isCustomer={ticket.created_by === user?.id}
              hasAssignee={!!ticket.assigned_to}
              executorGroups={executorGroups}
              onUpdateStatus={(statusId) => lockedHandleUpdateStatus(Number(statusId))}
              onAssignUser={lockedHandleAssignUser}
              onAssignGroup={lockedHandleAssignGroup}
              onSendPing={lockedHandleSendPing}
              onApprovalChange={loadTicket}
              onUpdateDueDate={isClosed ? undefined : lockedHandleUpdateDueDate}
              onReopened={loadTicket}
              hidePing={isClosed || needsCreatorConfirmation}
            />
          </div>

          <div className="lg:hidden w-full space-y-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-[#1b254b]/50 border border-border text-foreground text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Icon name="Info" size={16} />
                Информация о заявке
              </span>
              <Icon
                name="ChevronDown"
                size={16}
                className={`transition-transform duration-200 ${sidebarOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              ref={sidebarRef}
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{
                maxHeight: sidebarOpen ? sidebarRef.current?.scrollHeight + 'px' : '0px',
                opacity: sidebarOpen ? 1 : 0,
              }}
            >
              <div className="pt-3">
                <TicketDetailsSidebar 
                  ticket={ticket}
                  statuses={statuses}
                  users={users}
                  executorUsers={executorUsers}
                  updating={updating || isClosed}
                  sendingPing={sendingPing}
                  isCustomer={ticket.created_by === user?.id}
                  hasAssignee={!!ticket.assigned_to}
                  executorGroups={executorGroups}
                  onUpdateStatus={(statusId) => lockedHandleUpdateStatus(Number(statusId))}
                  onAssignUser={lockedHandleAssignUser}
                  onAssignGroup={lockedHandleAssignGroup}
                  onSendPing={lockedHandleSendPing}
                  onApprovalChange={loadTicket}
                  onUpdateDueDate={isClosed ? undefined : lockedHandleUpdateDueDate}
                  onReopened={loadTicket}
                  hidePing
                />
              </div>
            </div>
          </div>



          {!isClosed && !needsCreatorConfirmation && (
            <div className="lg:hidden w-full">
              <Button
                onClick={lockedHandleSendPing}
                disabled={sendingPing}
                size="lg"
                className="w-full font-semibold bg-orange-500 hover:bg-orange-600 text-white"
              >
                {sendingPing ? (
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
                comments={comments}
                loadingComments={loadingComments}
                newComment={newComment}
                submittingComment={submittingComment}
                sendingPing={sendingPing}
                userId={user?.id}
                commentIsInternal={commentIsInternal}
                onToggleCommentInternal={setCommentIsInternal}
                onCommentChange={setNewComment}
                onSubmitComment={lockedHandleSubmitComment}
                onSendPing={lockedHandleSendPing}
                onReaction={lockedHandleReaction}
                onTogglePin={lockedHandleTogglePin}
                onDeleteComment={lockedHandleDeleteComment}
                onEditComment={lockedHandleEditComment}
                canDeleteComments={isAdmin}
                canEditComments={isAdmin}
                availableUsers={users}
                onFileUpload={handleFileUpload}
                uploadingFile={uploadingFile}
                pendingAttachments={pendingAttachments}
                onRemoveAttachment={removeAttachment}
                auditLogs={auditLogs}
                loadingHistory={loadingHistory}
                commentsBlocked={isClosed || (isReopened && !!isAssignee) || needsCreatorConfirmation}
                commentsBlockedMessage={
                  needsCreatorConfirmation
                    ? 'Сначала подтвердите или отклоните решение исполнителя — после этого комментарии снова станут доступны.'
                    : isClosed
                    ? 'Заявка закрыта. Откройте её повторно, чтобы оставлять комментарии.'
                    : 'Заявка открыта повторно. Для работы с ней необходимо сначала принять её в работу, изменив статус.'
                }
                participantIds={participantIds}
                myLastSeenAt={myLastSeenAt}
                onMarkRead={markCommentsRead}
                onUpdateContent={isClosed ? undefined : lockedHandleUpdateContent}
                updating={updating || isClosed}
                headerSlot={
                  isClosed ? (
                    <ReopenTicketButton ticketId={ticket.id} onReopened={loadTicket} />
                  ) : null
                }
              />
          </div>
          </div>
        </div>
      </div>

      <footer className="mt-auto pt-6 py-4 text-center text-xs text-muted-foreground border-t border-border/40">
        © 2026 Команда Мечты
      </footer>

      {confirmationMode && (
        <ConfirmationOverlay
          ticket={ticket}
          initialMode={confirmationMode}
          onChanged={() => { setConfirmationMode(null); loadTicket(); }}
          onClose={() => setConfirmationMode(null)}
        />
      )}

      <AlertDialog open={!!watcherDialog} onOpenChange={(open) => { if (!open) setWatcherDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Добавить в наблюдатели?</AlertDialogTitle>
            <AlertDialogDescription>
              Исполнитель <strong>{watcherDialog?.userName}</strong> был снят с заявки. Добавить его в наблюдатели, чтобы он видел дальнейшие обновления?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWatcherDialog(null)}>Нет</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (watcherDialog) handleAddWatcher(watcherDialog.userId);
                setWatcherDialog(null);
              }}
            >
              Добавить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default TicketDetails;