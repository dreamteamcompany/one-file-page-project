import Icon from '@/components/ui/icon';
import { Comment, getAvatarColor, getInitials, formatDate } from './TicketCommentsTypes';

interface TicketCommentsPinnedProps {
  pinnedComments: Comment[];
  pinnedExpanded: boolean;
  onToggleExpanded: () => void;
  onTogglePin?: (commentId: number) => void;
}

const TicketCommentsPinned = ({
  pinnedComments,
  pinnedExpanded,
  onToggleExpanded,
  onTogglePin,
}: TicketCommentsPinnedProps) => {
  if (pinnedComments.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-amber-500/10 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="Pin" size={14} className="text-amber-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-500">
            Закреплено ({pinnedComments.length})
          </span>
          {!pinnedExpanded && pinnedComments[0] && (
            <span className="text-xs text-muted-foreground truncate">
              · {pinnedComments[0].comment.slice(0, 80)}
            </span>
          )}
        </div>
        <Icon
          name="ChevronDown"
          size={14}
          className={`text-muted-foreground transition-transform ${pinnedExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {pinnedExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-amber-500/20">
          {pinnedComments.map((p) => (
            <div
              key={`pinned-${p.id}`}
              className="rounded-md bg-card border px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {p.user_photo_url ? (
                    <img
                      src={p.user_photo_url}
                      alt={p.user_full_name || p.user_name || ''}
                      className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-5 h-5 rounded-full ${getAvatarColor(p.user_id)} flex items-center justify-center flex-shrink-0 text-white text-[9px] font-bold`}
                    >
                      {getInitials(p.user_full_name || p.user_name)}
                    </div>
                  )}
                  <span className="text-xs font-medium truncate">
                    {p.user_full_name || p.user_name || 'Пользователь'}
                  </span>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    {formatDate(p.created_at)}
                    {p.edited_at && (
                      <span className="ml-1 italic">(изменено)</span>
                    )}
                  </span>
                </div>
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(p.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    title="Открепить"
                  >
                    <Icon name="X" size={14} />
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words text-foreground">
                {p.comment}
              </p>
              {p.attachments && p.attachments.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.attachments.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-attachment-link
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted hover:bg-accent text-xs"
                    >
                      <Icon name="Paperclip" size={10} />
                      <span className="truncate max-w-[160px]">{file.filename}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TicketCommentsPinned;