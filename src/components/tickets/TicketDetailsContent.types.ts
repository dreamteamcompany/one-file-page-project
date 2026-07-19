export interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
  display_value?: string;
  hide_label?: boolean;
}

export interface Ticket {
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
  creator_photo_url?: string;
  creator_department_name?: string;
  assigned_to?: number;
  assignee_name?: string;
  assignee_email?: string;
  assignee_photo_url?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  custom_fields?: CustomField[];
  ticket_service?: {
    id: number;
    name: string;
  };
  services?: Array<{
    id: number;
    name: string;
    category_name?: string;
  }>;
}

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name?: string;
  user_full_name?: string;
  user_photo_url?: string;
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

export interface AuditLog {
  id: number;
  field_name: string;
  user_name?: string;
  user_full_name?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface TicketDetailsContentProps {
  ticket: Ticket;
  comments: Comment[];
  loadingComments: boolean;
  newComment: string;
  submittingComment: boolean;
  sendingPing: boolean;
  userId?: number;
  onCommentChange: (value: string) => void;
  onSubmitComment: (parentCommentId?: number, mentionedUserIds?: number[], overrideText?: string) => void;
  onSendPing: () => void;
  onReaction: (commentId: number, emoji: string) => void;
  onTogglePin?: (commentId: number) => void;
  onDeleteComment?: (commentId: number) => void | Promise<void | boolean>;
  onEditComment?: (
    commentId: number,
    data: { comment?: string; created_at?: string },
  ) => Promise<boolean>;
  canDeleteComments?: boolean;
  canEditComments?: boolean;
  availableUsers?: Array<{ id: number; name: string; email: string }>;
  onFileUpload?: (fileOrFiles: File | FileList | File[]) => Promise<void>;
  uploadingFile?: boolean;
  pendingAttachments?: import('@/hooks/useFileUploader').UploadedAttachment[];
  onRemoveAttachment?: (id: string) => void;
  auditLogs?: AuditLog[];
  loadingHistory?: boolean;
  commentsBlocked?: boolean;
  commentsBlockedMessage?: string;
  participantIds?: number[];
  myLastSeenAt?: string | null;
  onMarkRead?: (commentIds: number[]) => void;
  onUpdateContent?: (payload: {
    title?: string;
    description?: string;
    custom_fields?: Record<string, string>;
    ticket_service_id?: number | null;
  }) => Promise<boolean>;
  updating?: boolean;
  headerSlot?: React.ReactNode;
  commentIsInternal?: boolean;
  onToggleCommentInternal?: (value: boolean) => void;
}