import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketData } from '@/hooks/useTicketData';
import { useTicketActions } from '@/hooks/useTicketActions';
import { useTicketMarkRead } from '@/hooks/useTicketMarkRead';
import { useToast } from '@/hooks/use-toast';

export const useTicketDetailsPage = () => {
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
    statusError,
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

  return {
    navigate,
    menuOpen,
    setMenuOpen,
    sidebarOpen,
    setSidebarOpen,
    confirmationMode,
    setConfirmationMode,
    watcherDialog,
    setWatcherDialog,
    sidebarRef,
    user,
    hasPermission,
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
    participantIds,
    myLastSeenAt,
    markCommentsRead,
    newComment,
    setNewComment,
    commentIsInternal,
    setCommentIsInternal,
    submittingComment,
    updating,
    sendingPing,
    statusError,
    uploadingFile,
    pendingAttachments,
    removeAttachment,
    handleFileUpload,
    handleAddWatcher,
    isAdmin,
    canViewTickets,
    isAssignee,
    isReopened,
    isClosed,
    lockedHandleUpdateStatus,
    lockedHandleAssignUser,
    lockedHandleAssignGroup,
    lockedHandleUpdateDueDate,
    lockedHandleSendPing,
    lockedHandleSubmitComment,
    lockedHandleReaction,
    lockedHandleTogglePin,
    lockedHandleDeleteComment,
    lockedHandleEditComment,
    lockedHandleUpdateContent,
    needsCreatorConfirmation,
    handleBack,
  };
};
