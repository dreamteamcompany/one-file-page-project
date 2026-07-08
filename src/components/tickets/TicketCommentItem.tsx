import { Fragment } from 'react';
import Icon from '@/components/ui/icon';
import { renderRichText } from '@/components/shared/RichText';
import InlineCommentImage from '@/components/shared/InlineCommentImage';
import { Comment, User, getAvatarColor, getInitials, formatDate } from './TicketCommentsTypes';

const INLINE_COMMENT_RE = /!\[([^\]]*)\]\(inline:\/\/comment\/(\d+)\)/g;

interface TicketCommentItemProps {
  comment: Comment;
  parentComment: Comment | null;
  isOwn: boolean;
  showNewDivider: boolean;
  status: 'sent' | 'delivered' | 'read' | null;
  availableUsers: User[];
  canEditComments: boolean;
  canDeleteComments: boolean;
  onTogglePin?: (commentId: number) => void;
  onEditComment?: (
    commentId: number,
    data: { comment?: string; created_at?: string },
  ) => Promise<boolean>;
  onDeleteComment?: (commentId: number) => void | Promise<void | boolean>;
  onReply: (comment: Comment) => void;
  onSetEditTarget: (comment: Comment) => void;
  onSetDeleteTargetId: (id: number) => void;
  observeRef: (el: HTMLDivElement | null) => void;
  onJumpToComment?: (commentId: number) => void;
}

const renderHtmlPart = (text: string, mentioned: number[] | undefined, availableUsers: User[]) => {
  let result = renderRichText(text);

  if (mentioned && mentioned.length > 0) {
    mentioned.forEach((userId) => {
      const user = availableUsers.find((u) => u.id === userId);
      if (user) {
        result = result.replace(
          new RegExp(`@${user.name}`, 'g'),
          `<span class="inline-flex items-center rounded px-1 py-0.5 bg-black/10 dark:bg-white/20 text-inherit font-semibold">@${user.name}</span>`,
        );
      }
    });
  }

  return result;
};

const renderCommentText = (
  text: string,
  mentioned: number[] | undefined,
  availableUsers: User[],
) => {
  const parts: Array<{ type: 'html'; html: string } | { type: 'inline'; id: number; alt: string }> = [];
  let lastIndex = 0;

  INLINE_COMMENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_COMMENT_RE.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      parts.push({ type: 'html', html: renderHtmlPart(before, mentioned, availableUsers) });
    }
    parts.push({ type: 'inline', id: Number(match[2]), alt: match[1] || 'image' });
    lastIndex = match.index + match[0].length;
  }
  const tail = text.slice(lastIndex);
  if (tail) {
    parts.push({ type: 'html', html: renderHtmlPart(tail, mentioned, availableUsers) });
  }

  if (parts.length === 0) {
    return <span dangerouslySetInnerHTML={{ __html: renderHtmlPart(text, mentioned, availableUsers) }} />;
  }

  return (
    <>
      {parts.map((part, idx) =>
        part.type === 'html' ? (
          <span key={idx} dangerouslySetInnerHTML={{ __html: part.html }} />
        ) : (
          <Fragment key={idx}>
            <InlineCommentImage commentId={part.id} alt={part.alt} />
          </Fragment>
        ),
      )}
    </>
  );
};

const TicketCommentItem = ({
  comment,
  parentComment,
  isOwn,
  showNewDivider,
  status,
  availableUsers,
  canEditComments,
  canDeleteComments,
  onTogglePin,
  onEditComment,
  onDeleteComment,
  onReply,
  onSetEditTarget,
  onSetDeleteTargetId,
  observeRef,
  onJumpToComment,
}: TicketCommentItemProps) => {
  const isReopenComment = comment.comment.startsWith('🔄 Заявка открыта повторно');

  if (isReopenComment) {
    const reasonLine = comment.comment.split('\n\nПричина: ')[1] || '';
    return (
      <div ref={observeRef} data-comment-id={comment.id}>
        {showNewDivider && (
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-red-500" />
            <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30">
              Новые сообщения
            </span>
            <div className="flex-1 h-px bg-red-500" />
          </div>
        )}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-amber-500/30" />
          <div className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 max-w-sm text-center">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wide">
              <Icon name="RotateCcw" size={13} />
              Заявка открыта повторно
            </div>
            {reasonLine && (
              <p className="text-xs text-muted-foreground leading-relaxed">{reasonLine}</p>
            )}
            <p className="text-[11px] text-muted-foreground/60">{formatDate(comment.created_at)} · {comment.user_full_name || comment.user_name}</p>
          </div>
          <div className="flex-1 h-px bg-amber-500/30" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {showNewDivider && (
        <div className="flex items-center gap-2 my-3" aria-label="Новые сообщения">
          <div className="flex-1 h-px bg-red-500" />
          <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30">
            Новые сообщения
          </span>
          <div className="flex-1 h-px bg-red-500" />
        </div>
      )}
      <div
        ref={observeRef}
        data-comment-id={comment.id}
        className={`flex items-start gap-2.5 ${isOwn ? 'flex-row-reverse justify-start' : ''} ${
          comment.parent_comment_id
            ? isOwn
              ? 'mr-4 lg:mr-8'
              : 'ml-4 lg:ml-8'
            : ''
        }`}
      >
        {comment.user_photo_url ? (
          <img
            src={comment.user_photo_url}
            alt={comment.user_full_name || comment.user_name || ''}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
          />
        ) : (
          <div className={`w-8 h-8 rounded-full ${getAvatarColor(comment.user_id)} flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-xs font-bold`}>
            {getInitials(comment.user_full_name || comment.user_name)}
          </div>
        )}
        <div className="max-w-[80%] min-w-[120px] min-w-0">
          <div className={`flex items-baseline gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
            <p className="font-semibold text-xs">{comment.user_full_name || comment.user_name || 'Пользователь'}</p>
            {comment.is_internal && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                <Icon name="EyeOff" size={10} />
                Скрытый
              </span>
            )}
            <p className="text-[11px] text-muted-foreground">
              {formatDate(comment.created_at)}
              {comment.edited_at && (
                <span
                  className="ml-1 italic"
                  title={`Изменено: ${formatDate(comment.edited_at)}`}
                >
                  (изменено)
                </span>
              )}
            </p>
          </div>
          <div className={`rounded-2xl px-3.5 py-2.5 ${
            comment.is_internal
              ? `border border-amber-300 bg-amber-50 text-amber-900 ${isOwn ? 'rounded-tr-md' : 'rounded-tl-md'}`
              : isOwn
                ? 'bg-primary text-primary-foreground rounded-tr-md'
                : 'bg-muted text-foreground rounded-tl-md'
          }`}>
            {parentComment && (
              <button
                type="button"
                onClick={() => onJumpToComment?.(parentComment.id)}
                title="Перейти к исходному комментарию"
                className={`group w-full text-left mb-2 rounded-lg pl-2.5 pr-2 py-1.5 border-l-4 transition-colors cursor-pointer ${
                  isOwn
                    ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25 border-primary-foreground/70'
                    : 'bg-primary/10 hover:bg-primary/20 border-primary'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <Icon name="CornerDownRight" size={12} className={isOwn ? 'text-primary-foreground/80' : 'text-primary'} />
                  <span className={`font-semibold ${isOwn ? 'text-primary-foreground' : 'text-primary'}`}>
                    {parentComment.user_full_name || parentComment.user_name}
                  </span>
                </div>
                <p className={`text-xs line-clamp-2 mt-0.5 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {parentComment.comment}
                </p>
              </button>
            )}
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {renderCommentText(comment.comment, comment.mentioned_user_ids, availableUsers)}
            </p>

            {comment.attachments && comment.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {comment.attachments.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                      isOwn ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' : 'bg-background/50 hover:bg-background'
                    }`}
                  >
                    <Icon name="Paperclip" size={12} />
                    <span>{file.filename}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {comment.reactions && comment.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {comment.reactions.map((reaction, rIdx) => (
                <button
                  key={rIdx}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-accent transition-colors text-xs"
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-muted-foreground">{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'justify-end' : ''}`}>
            <button
              onClick={() => onReply(comment)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Icon name="Reply" size={12} />
              Ответить
            </button>
            {onTogglePin && (
              <button
                onClick={() => onTogglePin(comment.id)}
                className={`text-xs transition-colors flex items-center gap-1 ${
                  comment.is_pinned
                    ? 'text-amber-500 hover:text-amber-600'
                    : 'text-muted-foreground hover:text-primary'
                }`}
                title={comment.is_pinned ? 'Открепить' : 'Закрепить'}
              >
                <Icon name="Pin" size={12} />
                {comment.is_pinned ? 'Открепить' : 'Закрепить'}
              </button>
            )}
            {canEditComments && onEditComment && (
              <button
                onClick={() => onSetEditTarget(comment)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                title="Изменить комментарий"
              >
                <Icon name="Pencil" size={12} />
                Изменить
              </button>
            )}
            {canDeleteComments && onDeleteComment && (
              <button
                onClick={() => onSetDeleteTargetId(comment.id)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                title="Удалить комментарий"
              >
                <Icon name="Trash2" size={12} />
                Удалить
              </button>
            )}
            {isOwn && status && (
              <span
                className="inline-flex items-center"
                title={
                  status === 'read'
                    ? 'Прочитано всеми участниками'
                    : status === 'delivered'
                    ? 'Кто-то увидел'
                    : 'Отправлено'
                }
              >
                {status === 'sent' && (
                  <Icon name="Check" size={14} className="text-muted-foreground" />
                )}
                {status === 'delivered' && (
                  <Icon name="CheckCheck" size={14} className="text-muted-foreground" />
                )}
                {status === 'read' && (
                  <Icon name="CheckCheck" size={14} className="text-sky-500" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketCommentItem;