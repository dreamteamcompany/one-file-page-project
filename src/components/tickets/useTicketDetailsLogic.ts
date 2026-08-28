import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Ticket, Comment, User } from './TicketDetailsModalTypes';
import { API_URL, apiFetch } from '@/utils/api';
import { FN } from '@/config/backend';

export const useTicketDetailsLogic = (ticket: Ticket | null, onTicketUpdate?: () => void) => {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [executorUsers, setExecutorUsers] = useState<User[]>([]);
  const [updating, setUpdating] = useState(false);
  const [sendingPing, setSendingPing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'tasks' | 'related' | 'sla'>('info');

  useEffect(() => {
    if (ticket?.id && token) {
      loadComments();
      loadUsers();
      loadExecutorUsers();
    }
  }, [ticket?.id, token]);

  const loadUsers = async () => {
    if (!token) {
      console.log('[loadUsers] No token available');
      return;
    }

    console.log('[loadUsers] Starting to load users...');
    try {
      const response = await apiFetch(`${API_URL}?endpoint=users`, {
        headers: { 'X-Auth-Token': token },
      });

      console.log('[loadUsers] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[loadUsers] Received data:', data);
        console.log('[loadUsers] Users count:', data?.length || 0);
        
        const adaptedUsers = Array.isArray(data) ? (data as Array<{ id: number; full_name?: string; username?: string; is_active?: boolean }>)
          .filter((u) => u.is_active !== false)
          .map((u) => ({
            id: u.id,
            name: u.full_name || u.username,
            email: u.username,
            role: ''
          })) : [];
        
        setUsers(adaptedUsers);
      } else {
        const errorText = await response.text();
        console.error('[loadUsers] Error response:', errorText);
      }
    } catch (err) {
      console.error('[loadUsers] Failed to load users:', err);
    }
  };

  const loadExecutorUsers = async () => {
    if (!token) return;
    try {
      const response = await apiFetch(`${API_URL}?endpoint=users&system_roles=admin,executor`, {
        headers: { 'X-Auth-Token': token },
      });
      if (response.ok) {
        const data = await response.json();
        const adaptedUsers = Array.isArray(data) ? (data as Array<{ id: number; full_name?: string; username?: string; is_active?: boolean }>)
          .filter((u) => u.is_active !== false)
          .map((u) => ({
            id: u.id,
            name: u.full_name || u.username,
            email: u.username,
            role: ''
          })) : [];
        setExecutorUsers(adaptedUsers);
      }
    } catch (err) {
      console.error('[loadExecutorUsers] Failed:', err);
    }
  };

  const loadComments = async () => {
    if (!ticket?.id || !token) return;

    setLoadingComments(true);
    try {
      const commentsUrl = FN.TICKET_COMMENTS;
      const response = await apiFetch(`${commentsUrl}?ticket_id=${ticket.id}`, {
        headers: { 'X-Auth-Token': token },
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async (files?: File[]) => {
    if (!newComment.trim() || !ticket?.id || !token) return;

    setSubmittingComment(true);
    try {
      const commentsUrl = FN.TICKET_COMMENTS;
      const response = await apiFetch(commentsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          ticket_id: ticket.id,
          comment: newComment,
          is_internal: false,
        }),
      });

      if (response.ok) {
        setNewComment('');
        await loadComments();
        toast({
          title: 'Успешно',
          description: 'Комментарий добавлен',
        });
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось добавить комментарий',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить комментарий',
        variant: 'destructive',
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateStatus = async (statusId: string) => {
    if (!ticket?.id || !token) return;

    setUpdating(true);
    try {
      const response = await apiFetch(`${API_URL}?endpoint=tickets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          id: ticket.id,
          status_id: parseInt(statusId),
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Статус тикета обновлен',
        });
        if (onTicketUpdate) {
          onTicketUpdate();
        }
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось обновить статус',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить статус',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleSendPing = async () => {
    if (!ticket?.id || !token) return;

    setSendingPing(true);
    try {
      const commentsUrl = FN.TICKET_COMMENTS;
      await apiFetch(commentsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ 
          ticket_id: ticket.id, 
          comment: '🔔 Запрос статуса заявки',
          is_internal: false 
        }),
      });
      loadComments();
      toast({
        title: 'Успешно',
        description: 'Запрос отправлен',
      });
    } catch (err) {
      console.error('Failed to send ping:', err);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить запрос',
        variant: 'destructive',
      });
    } finally {
      setSendingPing(false);
    }
  };

  const handleReaction = async (commentId: number, emoji: string) => {
    if (!token) return;

    try {
      await apiFetch(`${API_URL}?endpoint=comment-reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ comment_id: commentId, emoji }),
      });
      loadComments();
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
  };

  const handleAssignUser = async (userId: string) => {
    if (!ticket?.id || !token) return;

    setUpdating(true);
    try {
      const mainUrl = FN.FINANCE;
      const assignedUserId = userId === 'unassign' ? null : Number(userId);
      
      const response = await fetch(`${mainUrl}?endpoint=tickets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ 
          id: ticket.id, 
          assigned_to: assignedUserId 
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Исполнитель назначен',
        });
        if (onTicketUpdate) {
          onTicketUpdate();
        }
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось назначить исполнителя',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to assign user:', err);
      toast({
        title: 'Ошибка',
        description: 'Не удалось назначить исполнителя',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  return {
    comments,
    newComment,
    setNewComment,
    loadingComments,
    submittingComment,
    users,
    executorUsers,
    updating,
    sendingPing,
    activeTab,
    setActiveTab,
    user,
    handleSubmitComment,
    handleUpdateStatus,
    handleSendPing,
    handleReaction,
    handleAssignUser,
  };
};