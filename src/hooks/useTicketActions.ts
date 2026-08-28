import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, apiFetch } from '@/utils/api';
import { useFileUploader } from '@/hooks/useFileUploader';
import { FN } from '@/config/backend';

export const useTicketActions = (
  ticketId: string | undefined,
  loadTicket: (showLoader?: boolean) => Promise<void>,
  loadComments: () => Promise<void>,
  loadHistory: () => Promise<void>
) => {
  const { token, hasPermission } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [commentIsInternal, setCommentIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sendingPing, setSendingPing] = useState(false);
  const [statusError, setStatusError] = useState('');
  const commentUploader = useFileUploader('uploads/attachments');

  const handleSubmitComment = async (parentCommentId?: number, mentionedUserIds?: number[], overrideText?: string) => {
    const text = (overrideText ?? newComment).trim();
    const ready = commentUploader.successful;
    if (!text && ready.length === 0) return;
    if (commentUploader.isUploading) return;

    try {
      setSubmittingComment(true);
      const commentsUrl = FN.TICKET_COMMENTS;
      const response = await apiFetch(commentsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          comment: text,
          is_internal: commentIsInternal,
          parent_comment_id: parentCommentId,
          mentioned_user_ids: mentionedUserIds,
          attachments: ready.map((a) => ({
            filename: a.filename,
            url: a.url,
            size: a.size,
          })),
        }),
      });

      if (response.ok) {
        setNewComment('');
        setCommentIsInternal(false);
        commentUploader.clear();
        loadComments();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateStatus = async (statusId: number) => {
    if (!hasPermission('tickets', 'update')) {
      console.error('Нет прав для изменения статуса заявки');
      return;
    }
    
    try {
      setUpdating(true);
      setStatusError('');
      const response = await apiFetch(`${API_URL}?endpoint=tickets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ id: ticketId, status_id: statusId }),
      });

      if (response.ok) {
        loadTicket(false);
        loadHistory();
        return;
      }

      const data = await response.json().catch(() => ({}));
      setStatusError(data?.error || 'Не удалось изменить статус заявки');
    } catch (error) {
      console.error('Error updating status:', error);
      setStatusError('Нет связи с сервером. Статус не изменён');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendPing = async () => {
    try {
      setSendingPing(true);
      const commentsUrl = FN.TICKET_COMMENTS;
      await apiFetch(commentsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ 
          ticket_id: ticketId, 
          comment: '🔔 Запрос статуса заявки',
          is_internal: false
        }),
      });
      loadComments();
    } catch (error) {
      console.error('Error sending ping:', error);
    } finally {
      setSendingPing(false);
    }
  };

  const handleReaction = async (commentId: number, emoji: string) => {
    console.log('Reactions feature not yet implemented');
  };

  const handleTogglePin = async (commentId: number) => {
    try {
      const url = `${FN.TICKET_COMMENTS}?action=toggle-pin`;
      const resp = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({ comment_id: commentId }),
      });
      if (resp.ok) {
        loadComments();
      }
    } catch (err) {
      console.error('Toggle pin failed:', err);
    }
  };

  const handleEditComment = async (
    commentId: number,
    data: { comment?: string; created_at?: string },
  ): Promise<boolean> => {
    try {
      const url = FN.TICKET_COMMENTS;
      const resp = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({ comment_id: commentId, ...data }),
      });
      if (resp.ok) {
        await loadComments();
        return true;
      }
      const errData = await resp.json().catch(() => ({}));
      console.error('Edit comment failed:', resp.status, errData);
      return false;
    } catch (err) {
      console.error('Edit comment failed:', err);
      return false;
    }
  };

  const handleDeleteComment = async (commentId: number): Promise<boolean> => {
    try {
      const url = `${FN.TICKET_COMMENTS}?id=${commentId}`;
      const resp = await apiFetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({ id: commentId }),
      });
      if (resp.ok) {
        await loadComments();
        return true;
      }
      const data = await resp.json().catch(() => ({}));
      console.error('Delete comment failed:', resp.status, data);
      return false;
    } catch (err) {
      console.error('Delete comment failed:', err);
      return false;
    }
  };

  const handleFileUpload = async (fileOrFiles: File | FileList | File[]) => {
    if (fileOrFiles instanceof File) {
      await commentUploader.upload(fileOrFiles);
    } else {
      await commentUploader.uploadMany(fileOrFiles);
    }
  };

  const handleAssignUser = async (userId: string) => {
    console.log('Assign user:', userId);
    try {
      setUpdating(true);
      const assignedUserId = userId === 'unassign' ? null : Number(userId);
      
      console.log('Sending assign request:', { id: ticketId, assigned_to: assignedUserId });
      
      const response = await apiFetch(`${API_URL}?endpoint=tickets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ id: ticketId, assigned_to: assignedUserId }),
      });
      
      if (response.ok) {
        loadTicket(false);
        loadHistory();
      }
    } catch (error) {
      console.error('Error assigning user:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignGroup = async (
    groupId: string,
    currentAssignedTo?: number | null,
  ): Promise<{ clearedAssignee: number | null }> => {
    try {
      setUpdating(true);
      const executorGroupId = groupId === 'unassign' ? null : Number(groupId);
      const hadAssignee = executorGroupId !== null && currentAssignedTo ? currentAssignedTo : null;

      const body: Record<string, unknown> = { id: ticketId, executor_group_id: executorGroupId };
      if (hadAssignee) body.assigned_to = null;

      const response = await apiFetch(`${API_URL}?endpoint=tickets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        loadTicket(false);
        loadHistory();
      }
      return { clearedAssignee: hadAssignee };
    } catch (error) {
      console.error('Error assigning group:', error);
      return { clearedAssignee: null };
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateContent = async (payload: {
    title?: string;
    description?: string;
    custom_fields?: Record<string, string>;
    service_ids?: number[];
    ticket_service_id?: number | null;
  }): Promise<boolean> => {
    try {
      setUpdating(true);
      const response = await apiFetch(`${API_URL}?endpoint=tickets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ id: ticketId, ...payload }),
      });

      if (response.ok) {
        await loadTicket(false);
        await loadHistory();
        return true;
      }
      const errData = await response.json().catch(() => ({}));
      console.error('[UpdateContent] Ошибка:', response.status, errData);
      return false;
    } catch (error) {
      console.error('[UpdateContent] Ошибка:', error);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateDueDate = async (dueDate: string | null) => {
    try {
      setUpdating(true);
      console.log('[UpdateDueDate] Отправка:', { id: ticketId, due_date: dueDate });
      const response = await apiFetch(`${API_URL}?endpoint=tickets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ id: ticketId, due_date: dueDate }),
      });
      
      console.log('[UpdateDueDate] Ответ:', response.status, await response.text());
      
      if (response.ok) {
        await loadTicket(false);
        await loadHistory();
      }
    } catch (error) {
      console.error('[UpdateDueDate] Ошибка:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddWatcher = async (userId: number) => {
    try {
      await apiFetch(`${API_URL}?endpoint=ticket-watchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({ ticket_id: Number(ticketId), user_id: userId }),
      });
      loadTicket(false);
    } catch (error) {
      console.error('Error adding watcher:', error);
    }
  };

  return {
    newComment,
    setNewComment,
    commentIsInternal,
    setCommentIsInternal,
    submittingComment,
    updating,
    sendingPing,
    statusError,
    clearStatusError: () => setStatusError(''),
    uploadingFile: commentUploader.isUploading,
    pendingAttachments: commentUploader.attachments,
    removeAttachment: commentUploader.remove,
    clearAttachments: commentUploader.clear,
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
  };
};