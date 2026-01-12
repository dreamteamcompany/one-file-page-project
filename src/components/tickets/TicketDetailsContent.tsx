import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';

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
  category_name?: string;
  priority_name?: string;
  status_id?: number;
  status_name?: string;
  status_color?: string;
  creator_name?: string;
  creator_email?: string;
  created_at?: string;
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

interface User {
  id: number;
  name: string;
  email: string;
}

interface TicketDetailsContentProps {
  ticket: Ticket;
  comments: Comment[];
  newComment: string;
  setNewComment: (value: string) => void;
  loadingComments: boolean;
  submittingComment: boolean;
  sendingPing: boolean;
  uploadingFile: boolean;
  auditLogs: AuditLog[];
  loadingHistory: boolean;
  users: User[];
  onSubmitComment: (parentCommentId?: number, mentionedUserIds?: number[]) => void;
  onSendPing: () => void;
  onAddReaction: (commentId: number, emoji: string) => void;
  onFileUpload: (file: File, commentId?: number) => void;
}

const TicketDetailsContent = ({
  ticket,
  comments,
  newComment,
  setNewComment,
  loadingComments,
  submittingComment,
  auditLogs,
  users,
  onSubmitComment,
  onAddReaction,
}: TicketDetailsContentProps) => {
  const [activeTab, setActiveTab] = useState<'description' | 'comments'>('description');

  const formatDateTime = (date?: string) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex-1 bg-card rounded-lg shadow-sm border">
      <div className="border-b">
        <div className="flex gap-1 p-2">
          <button
            onClick={() => setActiveTab('description')}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              activeTab === 'description'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Icon name="List" className="w-4 h-4" />
            Содержание
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              activeTab === 'comments'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Icon name="MessageSquare" className="w-4 h-4" />
            Комментарии
            <Badge variant="secondary" className="ml-1">{comments.length}</Badge>
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'description' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">Содержание</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">ФИО:</span>
                  <p className="mt-1">{ticket.creator_name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Логин:</span>
                  <p className="mt-1">{ticket.creator_email || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Доступ к ИС:</span>
                  <p className="mt-1">-</p>
                </div>
              </div>
            </div>

            {ticket.custom_fields && ticket.custom_fields.length > 0 && (
              <div className="space-y-3">
                {ticket.custom_fields.map((field) => (
                  <div key={field.id}>
                    <span className="text-sm text-muted-foreground">{field.name}:</span>
                    <p className="text-sm mt-1">{field.value || '-'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                Комментарии
              </h3>
              <Button variant="link" size="sm" className="text-primary">
                <Icon name="RefreshCw" className="w-4 h-4 mr-1" />
                Пометить все прочтенными
              </Button>
            </div>

            {loadingComments ? (
              <div className="flex justify-center py-8">
                <Icon name="Loader2" className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="MessageSquare" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Комментариев пока нет</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 pb-4 border-b last:border-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="User" className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {comment.user_name || 'Администратор'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          добавил ответ: {formatDateTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                      
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {comment.attachments.map((file) => (
                            <a
                              key={file.id}
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <Icon name="Paperclip" className="w-4 h-4" />
                              {file.filename}
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs text-primary h-auto p-0"
                          onClick={() => {}}
                        >
                          <Icon name="Reply" className="w-3 h-3 mr-1" />
                          Пометить прочтённым
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs text-primary h-auto p-0"
                        >
                          <Icon name="Link" className="w-3 h-3 mr-1" />
                          Цитировать
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Введите комментарий..."
                className="min-h-[100px]"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => onSubmitComment()}
                  disabled={submittingComment || !newComment.trim()}
                >
                  {submittingComment ? (
                    <>
                      <Icon name="Loader2" className="w-4 h-4 mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Icon name="Send" className="w-4 h-4 mr-2" />
                      Отправить
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetailsContent;