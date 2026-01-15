import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/utils/api';

export const useTicketActions = (
  ticketId: string | undefined,
  loadTicket: () => Promise<void>,
  loadComments: () => Promise<void>,
  loadHistory: () => Promise<void>
) => {
  const { token } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sendingPing, setSendingPing] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleSubmitComment = async (parentCommentId?: number, mentionedUserIds?: number[]) => {
    if (!newComment.trim()) return;
    
    try {
      setSubmittingComment(true);
      const response = await fetch(`${API_URL}?endpoint=ticket-comments-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ 
          ticket_id: ticketId, 
          comment: newComment, 
          is_internal: false,
          parent_comment_id: parentCommentId,
          mentioned_user_ids: mentionedUserIds || []
        }),
      });
      
      if (response.ok) {
        setNewComment('');
        loadComments();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateStatus = async (statusId: number) => {
    try {
      setUpdating(true);
      const response = await fetch(`${API_URL}?endpoint=tickets-api`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ ticket_id: ticketId, status_id: statusId }),
      });
      
      if (response.ok) {
        loadTicket();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendPing = async () => {
    try {
      setSendingPing(true);
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      await fetch(`${mainUrl}?endpoint=ticket-comments-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ ticket_id: ticketId, is_ping: true }),
      });
      loadComments();
    } catch (error) {
      console.error('Error sending ping:', error);
    } finally {
      setSendingPing(false);
    }
  };

  const handleReaction = async (commentId: number, emoji: string) => {
    try {
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      await fetch(`${mainUrl}?endpoint=comment-reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ comment_id: commentId, emoji }),
      });
      loadComments();
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFile(true);
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      await new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            const response = await fetch(`${mainUrl}?endpoint=upload-file`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': token,
              },
              body: JSON.stringify({
                file_data: base64,
                filename: file.name,
                content_type: file.type,
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              setNewComment(prev => prev + `\n[Файл: ${file.name}](${data.url})`);
            }
            resolve(null);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
      });
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAssignUser = async (userId: string) => {
    console.log('Assign user:', userId);
    try {
      setUpdating(true);
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const assignedUserId = userId === 'unassign' ? null : Number(userId);
      
      console.log('Sending assign request:', { ticket_id: ticketId, assigned_to: assignedUserId });
      
      const response = await fetch(`${mainUrl}?endpoint=tickets-api`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ ticket_id: ticketId, assigned_to: assignedUserId }),
      });
      
      console.log('Assign response:', response.status, await response.text());
      
      if (response.ok) {
        loadTicket();
        loadHistory();
      }
    } catch (error) {
      console.error('Error assigning user:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateDueDate = async (dueDate: string | null) => {
    try {
      setUpdating(true);
      const response = await fetch(`${API_URL}?endpoint=tickets-api`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ ticket_id: ticketId, due_date: dueDate }),
      });
      
      if (response.ok) {
        loadTicket();
        loadHistory();
      }
    } catch (error) {
      console.error('Error updating due date:', error);
    } finally {
      setUpdating(false);
    }
  };

  return {
    newComment,
    setNewComment,
    submittingComment,
    updating,
    sendingPing,
    uploadingFile,
    handleSubmitComment,
    handleUpdateStatus,
    handleSendPing,
    handleReaction,
    handleFileUpload,
    handleAssignUser,
    handleUpdateDueDate,
  };
};
