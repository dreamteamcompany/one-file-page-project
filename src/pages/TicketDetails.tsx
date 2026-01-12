import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import TicketDetailsPageHeader from '@/components/tickets/TicketDetailsPageHeader';
import TicketDetailsContent from '@/components/tickets/TicketDetailsContent';
import TicketDetailsSidebar from '@/components/tickets/TicketDetailsSidebar';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
}

interface Ticket {
  id: number;
  title: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
  priority_id?: number;
  priority_name?: string;
  priority_color?: string;
  status_id?: number;
  status_name?: string;
  status_color?: string;
  department_id?: number;
  department_name?: string;
  created_by: number;
  creator_name?: string;
  creator_email?: string;
  assigned_to?: number;
  assignee_name?: string;
  assignee_email?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  custom_fields?: CustomField[];
}

interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  comment: string;
  is_internal: boolean;
  created_at?: string;
  attachments?: {
    id: number;
    filename: string;
    url: string;
    size: number;
  }[];
  reactions?: {
    emoji: string;
    count: number;
    users: number[];
  }[];
}

interface AuditLog {
  id: number;
  action: string;
  username: string;
  changed_fields?: any;
  old_values?: any;
  new_values?: any;
  metadata?: any;
  created_at: string;
}

interface Status {
  id: number;
  name: string;
  color: string;
  order: number;
}

const TicketDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(location.state?.ticket || null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(!location.state?.ticket);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sendingPing, setSendingPing] = useState(false);
  const [users, setUsers] = useState<Array<{id: number; name: string; email: string}>>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (id) {
      loadTicket();
      loadStatuses();
      loadComments();
      loadUsers();
      loadHistory();
    }
  }, [id]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const response = await fetch(`${mainUrl}?endpoint=tickets-api`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const foundTicket = data.tickets?.find((t: Ticket) => t.id === Number(id));
        if (foundTicket) {
          setTicket(foundTicket);
        }
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatuses = async () => {
    try {
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const response = await fetch(`${mainUrl}?endpoint=ticket-dictionaries-api`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error('Error loading statuses:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const response = await fetch(`${mainUrl}?endpoint=users`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const adaptedUsers = Array.isArray(data) ? data.map((u: any) => ({
          id: u.id,
          name: u.full_name || u.username,
          email: u.username,
          role: ''
        })) : [];
        setUsers(adaptedUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const response = await fetch(`${mainUrl}?endpoint=ticket-history&ticket_id=${id}`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadComments = async () => {
    try {
      setLoadingComments(true);
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const response = await fetch(`${mainUrl}?endpoint=ticket-comments-api&ticket_id=${id}`, {
        headers: {
          'X-Auth-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async (parentCommentId?: number, mentionedUserIds?: number[]) => {
    if (!newComment.trim()) return;
    
    try {
      setSubmittingComment(true);
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const response = await fetch(`${mainUrl}?endpoint=ticket-comments-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ 
          ticket_id: id, 
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
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const response = await fetch(`${mainUrl}?endpoint=tickets-api`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ ticket_id: id, status_id: statusId }),
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
        body: JSON.stringify({ ticket_id: id, is_ping: true }),
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
      
      console.log('Sending assign request:', { ticket_id: id, assigned_to: assignedUserId });
      
      const response = await fetch(`${mainUrl}?endpoint=tickets-api`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ ticket_id: id, assigned_to: assignedUserId }),
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
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const response = await fetch(`${mainUrl}?endpoint=tickets-api`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({ ticket_id: id, due_date: dueDate }),
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
    <div className="min-h-screen bg-background">
      <TicketDetailsPageHeader 
        ticketId={ticket.id}
        onBack={() => navigate('/tickets')}
      />

      <div className="container max-w-[1600px] mx-auto px-4 lg:px-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-0">
          <TicketDetailsContent
            ticket={ticket}
            comments={comments}
            loadingComments={loadingComments}
            newComment={newComment}
            submittingComment={submittingComment}
            sendingPing={sendingPing}
            userId={user?.id}
            onCommentChange={setNewComment}
            onSubmitComment={handleSubmitComment}
            onSendPing={handleSendPing}
            onReaction={handleReaction}
            availableUsers={users}
            auditLogs={auditLogs}
            loadingHistory={loadingHistory}
            onFileUpload={handleFileUpload}
            uploadingFile={uploadingFile}
          />

          <div className="lg:hidden">
            <TicketDetailsSidebar 
              ticket={ticket}
              statuses={statuses}
              users={users}
              updating={updating}
              sendingPing={sendingPing}
              isCustomer={ticket.created_by === user?.id}
              hasAssignee={!!ticket.assigned_to}
              onUpdateStatus={(statusId) => handleUpdateStatus(Number(statusId))}
              onAssignUser={handleAssignUser}
              onSendPing={handleSendPing}
              onApprovalChange={loadTicket}
              onUpdateDueDate={handleUpdateDueDate}
            />
          </div>

          <div className="hidden lg:block">
            <TicketDetailsSidebar 
              ticket={ticket}
              statuses={statuses}
              users={users}
              updating={updating}
              sendingPing={sendingPing}
              isCustomer={ticket.created_by === user?.id}
              hasAssignee={!!ticket.assigned_to}
              onUpdateStatus={(statusId) => handleUpdateStatus(Number(statusId))}
              onAssignUser={handleAssignUser}
              onSendPing={handleSendPing}
              onApprovalChange={loadTicket}
              onUpdateDueDate={handleUpdateDueDate}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetails;