import { RefObject } from 'react';
import Icon from '@/components/ui/icon';
import { Comment, User, TicketCommentsProps } from './TicketCommentsTypes';
import TicketCommentItem from './TicketCommentItem';
import CommentReadIndicator from './CommentReadIndicator';
import { FeedItem } from './useTicketCommentsLogic';

interface TicketCommentsListProps {
  commentsListRef: RefObject<HTMLDivElement>;
  commentsEndRef: RefObject<HTMLDivElement>;
  loadingComments: boolean;
  feedItems: FeedItem[];
  firstNewIndex: number;
  latestCommentId: number | null;
  currentUserId?: number;
  availableUsers: User[];
  canEditComments: boolean;
  canDeleteComments: boolean;
  onTogglePin?: (commentId: number) => void;
  onEditComment?: TicketCommentsProps['onEditComment'];
  onDeleteComment?: TicketCommentsProps['onDeleteComment'];
  onReply: (comment: Comment) => void;
  onSetEditTarget: (comment: Comment | null) => void;
  onSetDeleteTargetId: (id: number | null) => void;
  observeComment: (el: HTMLDivElement | null, comment: Comment) => void;
  onJumpToComment: (commentId: number) => void;
  getParentComment: (parentId?: number) => Comment | null | undefined;
  getReadStatus: (comment: Comment) => 'sent' | 'delivered' | 'read';
}

const TicketCommentsList = ({
  commentsListRef,
  commentsEndRef,
  loadingComments,
  feedItems,
  firstNewIndex,
  latestCommentId,
  currentUserId,
  availableUsers,
  canEditComments,
  canDeleteComments,
  onTogglePin,
  onEditComment,
  onDeleteComment,
  onReply,
  onSetEditTarget,
  onSetDeleteTargetId,
  observeComment,
  onJumpToComment,
  getParentComment,
  getReadStatus,
}: TicketCommentsListProps) => {
  return (
    <div
      ref={commentsListRef}
      className="space-y-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 w-full max-w-full"
      style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain', wordBreak: 'break-word' }}
    >
      {loadingComments ? (
        <div className="flex items-center justify-center py-8">
          <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : feedItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Icon name="MessageSquare" size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Пока нет комментариев</p>
        </div>
      ) : (
        feedItems.map((item) => {
          const comment = item.data;
          const parentComment = getParentComment(comment.parent_comment_id);
          const isOwn = comment.user_id === currentUserId;
          const showNewDivider = item.idx === firstNewIndex;
          const status = isOwn ? getReadStatus(comment) : null;

          const isLatest = comment.id === latestCommentId;
          return (
            <div key={comment.id}>
              <TicketCommentItem
                comment={comment}
                parentComment={parentComment ?? null}
                isOwn={isOwn}
                showNewDivider={showNewDivider}
                status={status}
                availableUsers={availableUsers}
                canEditComments={canEditComments}
                canDeleteComments={canDeleteComments}
                onTogglePin={onTogglePin}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onReply={onReply}
                onSetEditTarget={onSetEditTarget}
                onSetDeleteTargetId={onSetDeleteTargetId}
                observeRef={(el) => observeComment(el, comment)}
                onJumpToComment={onJumpToComment}
              />
              {isLatest && <CommentReadIndicator comment={comment} />}
            </div>
          );
        })
      )}
      <div ref={commentsEndRef} />
    </div>
  );
};

export default TicketCommentsList;