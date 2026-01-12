import { useState } from 'react';
import Icon from '@/components/ui/icon';
import TicketComments from '@/components/tickets/TicketComments';
import TicketHistory from '@/components/tickets/TicketHistory';

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

interface TicketDetailsContentProps {
  ticket: Ticket;
  comments: Comment[];
  loadingComments: boolean;
  newComment: string;
  submittingComment: boolean;
  sendingPing: boolean;
  userId?: number;
  onCommentChange: (value: string) => void;
  onSubmitComment: (parentCommentId?: number, mentionedUserIds?: number[]) => void;
  onSendPing: () => void;
  onReaction: (commentId: number, emoji: string) => void;
  availableUsers?: Array<{id: number; name: string; email: string}>;
  onFileUpload?: (file: File) => Promise<void>;
  uploadingFile?: boolean;
  auditLogs?: AuditLog[];
  loadingHistory?: boolean;
}

const TicketDetailsContent = ({
  ticket,
  comments,
  loadingComments,
  newComment,
  submittingComment,
  sendingPing,
  userId,
  onCommentChange,
  onSubmitComment,
  onSendPing,
  onReaction,
  availableUsers,
  onFileUpload,
  uploadingFile,
  auditLogs = [],
  loadingHistory = false,
}: TicketDetailsContentProps) => {
  const [activeTab, setActiveTab] = useState<'comments' | 'files' | 'history'>('comments');
  return (
    <div className="flex-1 p-4 lg:p-6">
      {/* Суть заявки */}
      <div className="mb-4 lg:mb-6 border rounded-lg p-4 lg:p-5 bg-card">
        <button className="flex items-center gap-2 text-sm font-semibold mb-4 w-full">
          <Icon name="ChevronDown" size={16} />
          Суть заявки
        </button>
        
        <div className="space-y-3">
          <div>
            <span className="text-sm text-muted-foreground">Тема:</span>
            <p className="text-sm font-medium">{ticket.title}</p>
          </div>
          
          {ticket.description && (
            <div>
              <span className="text-sm text-muted-foreground">Описание:</span>
              <p className="text-sm whitespace-pre-wrap leading-relaxed mt-1">{ticket.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Комментарии, Файлы и История (вкладки) */}
      <div className="border-b mb-4">
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab('comments')}
            className={`pb-2 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'comments' 
                ? 'border-primary text-foreground' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Комментарии ({comments.length})
          </button>
          <button 
            onClick={() => setActiveTab('files')}
            className={`pb-2 border-b-2 text-sm transition-colors ${
              activeTab === 'files' 
                ? 'border-primary text-foreground font-medium' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Файлы (0)
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-2 border-b-2 text-sm transition-colors ${
              activeTab === 'history' 
                ? 'border-primary text-foreground font-medium' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            История ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="mb-6">
        {activeTab === 'comments' && (
          <TicketComments
            comments={comments}
            loadingComments={loadingComments}
            newComment={newComment}
            submittingComment={submittingComment}
            onCommentChange={onCommentChange}
            onSubmitComment={onSubmitComment}
            isCustomer={ticket.created_by === userId}
            hasAssignee={!!ticket.assigned_to}
            sendingPing={sendingPing}
            onSendPing={onSendPing}
            currentUserId={userId}
            onReaction={onReaction}
            availableUsers={availableUsers}
            onFileUpload={onFileUpload}
            uploadingFile={uploadingFile}
          />
        )}
        
        {activeTab === 'files' && (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="FileText" size={48} className="mx-auto mb-2 opacity-30" />
            <p>Файлы пока не загружены</p>
          </div>
        )}
        
        {activeTab === 'history' && (
          <TicketHistory 
            logs={auditLogs} 
            loading={loadingHistory}
          />
        )}
      </div>
    </div>
  );
};

export default TicketDetailsContent;