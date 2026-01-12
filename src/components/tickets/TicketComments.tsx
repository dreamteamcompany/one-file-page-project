import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  comment: string;
  is_internal: boolean;
  created_at?: string;
  parent_comment_id?: number;
  mentioned_user_ids?: number[];
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

interface User {
  id: number;
  name: string;
  email: string;
}

interface TicketCommentsProps {
  comments: Comment[];
  loadingComments: boolean;
  newComment: string;
  submittingComment: boolean;
  onCommentChange: (value: string) => void;
  onSubmitComment: (parentCommentId?: number, mentionedUserIds?: number[]) => void;
  isCustomer: boolean;
  hasAssignee: boolean;
  sendingPing: boolean;
  onSendPing: () => void;
  currentUserId?: number;
  onReaction?: (commentId: number, emoji: string) => void;
  availableUsers?: User[];
  onFileUpload?: (file: File) => Promise<void>;
  uploadingFile?: boolean;
}

const TicketComments = ({
  comments,
  loadingComments,
  newComment,
  submittingComment,
  onCommentChange,
  onSubmitComment,
  isCustomer,
  hasAssignee,
  sendingPing,
  onSendPing,
  currentUserId,
  availableUsers = [],
  onFileUpload,
  uploadingFile = false,
}: TicketCommentsProps) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyToComment, setReplyToComment] = useState<Comment | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<User[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const mentionsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (mentionsRef.current && !mentionsRef.current.contains(event.target as Node)) {
        setShowMentions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onCommentChange(newComment + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleReply = (comment: Comment) => {
    setReplyToComment(comment);
    textareaRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyToComment(null);
  };

  const handleMention = (user: User) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const beforeCursor = newComment.substring(0, cursorPos);
    const afterCursor = newComment.substring(cursorPos);
    const mentionText = `@${user.name} `;
    
    const newText = beforeCursor.replace(/@\w*$/, mentionText) + afterCursor;
    onCommentChange(newText);
    
    if (!mentionedUsers.find(u => u.id === user.id)) {
      setMentionedUsers([...mentionedUsers, user]);
    }
    
    setShowMentions(false);
    setMentionSearch('');
    
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeCursor.replace(/@\w*$/, mentionText).length;
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    onCommentChange(value);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const match = textBeforeCursor.match(/@(\w*)$/);

    if (match) {
      setMentionSearch(match[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const filteredUsers = availableUsers.filter(user =>
    user.name.toLowerCase().includes(mentionSearch.toLowerCase()) &&
    user.id !== currentUserId
  );

  const handleSubmit = () => {
    const mentionedUserIds = mentionedUsers.map(u => u.id);
    onSubmitComment(replyToComment?.id, mentionedUserIds);
    setReplyToComment(null);
    setMentionedUsers([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      await onFileUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getParentComment = (parentId?: number) => {
    if (!parentId) return null;
    return comments.find(c => c.id === parentId);
  };

  const renderCommentText = (text: string, mentioned?: number[]) => {
    if (!mentioned || mentioned.length === 0) return text;
    
    let result = text;
    mentioned.forEach(userId => {
      const user = availableUsers.find(u => u.id === userId);
      if (user) {
        result = result.replace(new RegExp(`@${user.name}`, 'g'), 
          `<span class="text-primary font-semibold">@${user.name}</span>`
        );
      }
    });
    
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="MessageSquare" size={18} className="text-muted-foreground" />
        <h3 className="text-base font-semibold">Комментарии</h3>
        <span className="text-sm text-muted-foreground">({comments.length})</span>
      </div>

      {/* Форма добавления комментария */}
      <div className="space-y-3 mb-6 pb-4 border-b">
        {isCustomer && hasAssignee && (
          <Button
            onClick={onSendPing}
            disabled={sendingPing}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {sendingPing ? (
              <>
                <Icon name="Loader2" size={14} className="mr-2 animate-spin" />
                Отправка запроса...
              </>
            ) : (
              <>
                <Icon name="Bell" size={14} className="mr-2" />
                Запросить статус
              </>
            )}
          </Button>
        )}

        {replyToComment && (
          <div className="p-3 bg-muted/50 rounded-lg border border-primary/20">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="CornerDownRight" size={14} className="text-primary" />
                  <span className="text-xs font-medium text-primary">Ответ на комментарий</span>
                  <span className="text-xs text-muted-foreground">{replyToComment.user_name}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{replyToComment.comment}</p>
              </div>
              <button
                onClick={handleCancelReply}
                className="p-1 hover:bg-destructive/20 rounded transition-colors"
              >
                <Icon name="X" size={14} className="text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
        
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Напишите комментарий... (используйте @ для упоминания)"
            value={newComment}
            onChange={handleTextChange}
            disabled={submittingComment}
            className="min-h-[90px] lg:min-h-[120px] resize-none pr-10 text-sm"
          />
          
          {showMentions && filteredUsers.length > 0 && (
            <div 
              ref={mentionsRef}
              className="absolute bottom-full left-0 mb-2 w-full max-w-xs bg-popover border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
            >
              {filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleMention(user)}
                  className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <Icon name="User" size={14} className="text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submittingComment}
            size="sm"
            className="flex-1 min-w-[120px]"
          >
            {submittingComment ? (
              <>
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Icon name="Send" size={16} className="mr-2" />
                {replyToComment ? 'Ответить' : 'Отправить'}
              </>
            )}
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploadingFile}
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile || submittingComment}
            variant="ghost"
            size="sm"
            className="flex-shrink-0"
            title="Прикрепить файл"
          >
            {uploadingFile ? (
              <Icon name="Loader2" size={16} className="animate-spin" />
            ) : (
              <Icon name="Paperclip" size={16} />
            )}
          </Button>
          
          <div className="relative">
            <Button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={submittingComment}
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              title="Добавить эмодзи"
            >
              <Icon name="Smile" size={16} />
            </Button>
            
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="absolute bottom-full right-0 mb-2 z-50">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Список комментариев */}
      <div className="space-y-3">
        {loadingComments ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="MessageSquare" size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Пока нет комментариев</p>
          </div>
        ) : (
          comments.map((comment) => {
            const parentComment = getParentComment(comment.parent_comment_id);
            
            return (
              <div 
                key={comment.id} 
                className={`p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors ${
                  comment.parent_comment_id ? 'ml-4 lg:ml-8 border-l-2 border-primary/30' : ''
                }`}
              >
                {parentComment && (
                  <div className="mb-2 p-2 bg-muted/30 rounded text-xs border-l-2 border-primary/50">
                    <div className="flex items-center gap-1 mb-1">
                      <Icon name="CornerDownRight" size={12} className="text-primary" />
                      <span className="font-medium">{parentComment.user_name}</span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{parentComment.comment}</p>
                  </div>
                )}
                
                <div className="flex items-start gap-2 lg:gap-3">
                  <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="User" size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="font-semibold text-sm">{comment.user_name || 'Пользователь'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(comment.created_at)}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
                      {renderCommentText(comment.comment, comment.mentioned_user_ids)}
                    </p>
                    
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {comment.attachments.map((file) => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded bg-background/50 hover:bg-background transition-colors group"
                          >
                            <Icon name="Paperclip" size={14} className="text-muted-foreground" />
                            <span className="text-xs flex-1 group-hover:text-primary transition-colors">{file.filename}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    
                    {comment.reactions && comment.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {comment.reactions.map((reaction, idx) => (
                          <button
                            key={idx}
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors text-xs"
                          >
                            <span style={{ fontSize: '1.5em' }}>{reaction.emoji}</span>
                            <span className="text-muted-foreground">{reaction.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleReply(comment)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <Icon name="Reply" size={12} />
                        Ответить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TicketComments;