import Icon from '@/components/ui/icon';
import { useState, useRef, useEffect } from 'react';
import { useMentionSearch } from '@/hooks/useMentionSearch';
import { getMskTimestamp } from '@/utils/dateFormat';


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EditCommentDialog from '@/components/tickets/EditCommentDialog';
import { Comment, User, TicketCommentsProps } from './TicketCommentsTypes';
import TicketCommentsPinned from './TicketCommentsPinned';
import TicketCommentItem from './TicketCommentItem';
import TicketCommentsInput from './TicketCommentsInput';
import CommentReadIndicator from './CommentReadIndicator';

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
  onTogglePin,
  onDeleteComment,
  onEditComment,
  canDeleteComments = false,
  canEditComments = false,
  availableUsers = [],
  onFileUpload,
  uploadingFile = false,
  pendingAttachments = [],
  onRemoveAttachment,
  commentsBlocked = false,
  commentsBlockedMessage,
  participantIds = [],
  myLastSeenAt = null,
  onMarkRead,
  canUseTemplates = false,
  canUseAI = false,
  canMarkInternal = false,
  commentIsInternal = false,
  onToggleCommentInternal,
}: TicketCommentsProps) => {

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyToComment, setReplyToComment] = useState<Comment | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<User[]>([]);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [editTarget, setEditTarget] = useState<Comment | null>(null);

  const pinnedComments = [...comments]
    .filter((c) => c.is_pinned)
    .sort((a, b) => getMskTimestamp(b.pinned_at) - getMskTimestamp(a.pinned_at));

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const mentionsRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentsListRef = useRef<HTMLDivElement>(null);

  const frozenLastSeenRef = useRef<string | null | undefined>(undefined);
  if (frozenLastSeenRef.current === undefined && !loadingComments) {
    frozenLastSeenRef.current = myLastSeenAt ?? null;
  }
  const frozenLastSeen = frozenLastSeenRef.current;

  const sortedAsc = [...comments].sort((a, b) => getMskTimestamp(a.created_at) - getMskTimestamp(b.created_at));
  const latestCommentId = sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1].id : null;

  type FeedItem = { kind: 'comment'; data: Comment; idx: number };

  const feedItems: FeedItem[] = [
    ...sortedAsc.map((c, idx) => ({ kind: 'comment' as const, data: c, idx })),
  ].sort((a, b) => getMskTimestamp(a.data.created_at) - getMskTimestamp(b.data.created_at));

  // Скролл вниз после загрузки комментариев — при первом заходе/обновлении страницы
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (loadingComments) return;
    if (comments.length === 0) return;
    if (didInitialScrollRef.current) return;

    const scrollToBottom = () => {
      const list = commentsListRef.current;
      if (list) {
        list.scrollTop = list.scrollHeight;
      }
      commentsEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
    };

    // Несколько попыток: контент (картинки, длинный текст) догружается асинхронно
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
    const t1 = setTimeout(scrollToBottom, 150);
    const t2 = setTimeout(scrollToBottom, 500);
    const t3 = setTimeout(() => {
      scrollToBottom();
      didInitialScrollRef.current = true;
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loadingComments, comments.length]);

  const firstNewIndex = (() => {
    if (!frozenLastSeen || !currentUserId) return -1;
    const cutoff = getMskTimestamp(frozenLastSeen);
    return sortedAsc.findIndex((c) => {
      if (c.user_id === currentUserId) return false;
      return getMskTimestamp(c.created_at) > cutoff;
    });
  })();

  const pendingReadRef = useRef<Set<number>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markedRef = useRef<Set<number>>(new Set());
  const onMarkReadRef = useRef(onMarkRead);
  useEffect(() => {
    onMarkReadRef.current = onMarkRead;
  }, [onMarkRead]);

  const flushReads = () => {
    flushTimerRef.current = null;
    const ids = Array.from(pendingReadRef.current);
    pendingReadRef.current.clear();
    if (ids.length && onMarkReadRef.current) {
      ids.forEach((id) => markedRef.current.add(id));
      onMarkReadRef.current(ids);
    }
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(flushReads, 600);
  };

  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        let added = false;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idAttr = (entry.target as HTMLElement).dataset.commentId;
          if (!idAttr) return;
          const id = parseInt(idAttr, 10);
          if (!id || markedRef.current.has(id)) return;
          pendingReadRef.current.add(id);
          markedRef.current.add(id);
          added = true;
          observerRef.current?.unobserve(entry.target);
        });
        if (added) scheduleFlush();
      },
      { threshold: 0.6 },
    );
    return () => {
      observerRef.current?.disconnect();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushReads();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const observeComment = (el: HTMLDivElement | null, comment: Comment) => {
    if (!el || !observerRef.current) return;
    if (!currentUserId || comment.user_id === currentUserId) return;
    if (markedRef.current.has(comment.id)) return;
    if (comment.read_by?.includes(currentUserId)) {
      markedRef.current.add(comment.id);
      return;
    }
    observerRef.current.observe(el);
  };

  const getReadStatus = (comment: Comment): 'sent' | 'delivered' | 'read' => {
    if (!participantIds || participantIds.length === 0) return 'sent';
    const others = participantIds.filter((id) => id !== comment.user_id);
    if (others.length === 0) return 'sent';
    const readBy = new Set(comment.read_by || []);
    const readOthers = others.filter((id) => readBy.has(id));
    if (readOthers.length === 0) return 'sent';
    if (readOthers.length === others.length) return 'read';
    return 'delivered';
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

  const handleEmojiClick = (emojiData: import('emoji-picker-react').EmojiClickData) => {
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
    if (!mentionedUsers.find(u => u.id === user.id)) {
      setMentionedUsers([...mentionedUsers, user]);
    }
    setShowMentions(false);
    setMentionSearch('');

    // Вставляем @username в contenteditable через Selection API
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Заменяем @... перед курсором на полное имя
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const offset = range.startOffset;
        const before = text.slice(0, offset);
        const match = before.match(/@([^@\s]*(?:\s[^@\s]*)?)$/);
        if (match) {
          const mentionText = `@${user.name} `;
          const newBefore = before.slice(0, before.length - match[0].length) + mentionText;
          node.textContent = newBefore + text.slice(offset);
          const newOffset = newBefore.length;
          range.setStart(node, newOffset);
          range.setEnd(node, newOffset);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }
    onCommentChange(newComment.replace(/@([^@\s]*(?:\s[^@\s]*)?)$/, `@${user.name} `));
  };

  const detectMention = (value: string, cursorPos?: number) => {
    const pos = cursorPos ?? value.length;
    const textBeforeCursor = value.substring(0, pos);
    const match = textBeforeCursor.match(/@([^@\s]*(?:\s[^@\s]*)?)$/);
    if (match) {
      setMentionSearch(match[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    onCommentChange(value);
    detectMention(value, e.target.selectionStart);
  };

  const handleEditorChange = (text: string) => {
    onCommentChange(text);
    detectMention(text);
  };

  const { users: searchedUsers, loading: searchingUsers } = useMentionSearch(
    mentionSearch,
    showMentions,
  );

  const remoteAsLocal: User[] = searchedUsers
    .filter((u) => u.id !== currentUserId)
    .map((u) => ({
      id: u.id,
      name: u.full_name || u.username,
      email: u.email || '',
    }));

  const mentionQuery = mentionSearch.trim().toLowerCase();
  const localFiltered = availableUsers.filter((user) => {
    if (user.id === currentUserId) return false;
    if (!mentionQuery) return true;
    const haystack = `${user.name} ${user.email}`.toLowerCase();
    return mentionQuery.split(/\s+/).every((part) => haystack.includes(part));
  });

  const seen = new Set<number>();
  const filteredUsers: User[] = [...remoteAsLocal, ...localFiltered].filter((u) => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });

  const scrollAfterSendRef = useRef(false);
  const prevCommentsCountRef = useRef(comments.length);

  const handleSubmit = () => {
    const mentionedUserIds = mentionedUsers.map(u => u.id);
    scrollAfterSendRef.current = true;
    onSubmitComment(replyToComment?.id, mentionedUserIds);
    setReplyToComment(null);
    setMentionedUsers([]);
  };

  useEffect(() => {
    if (!scrollAfterSendRef.current) {
      prevCommentsCountRef.current = comments.length;
      return;
    }
    if (comments.length <= prevCommentsCountRef.current) return;
    prevCommentsCountRef.current = comments.length;
    scrollAfterSendRef.current = false;

    const scrollToBottom = () => {
      const list = commentsListRef.current;
      if (list) list.scrollTop = list.scrollHeight;
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };
    requestAnimationFrame(scrollToBottom);
    const t1 = setTimeout(scrollToBottom, 200);
    const t2 = setTimeout(scrollToBottom, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [comments.length]);

  const getParentComment = (parentId?: number) => {
    if (!parentId) return null;
    return comments.find(c => c.id === parentId);
  };

  const handleJumpToComment = (commentId: number) => {
    const list = commentsListRef.current;
    if (!list) return;
    const target = list.querySelector<HTMLElement>(`[data-comment-id="${commentId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('comment-highlight');
    setTimeout(() => target.classList.remove('comment-highlight'), 2000);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <Icon name="MessageSquare" size={18} className="text-muted-foreground" />
        <h3 className="text-base font-semibold">Комментарии</h3>
        {loadingComments && comments.length === 0 ? null : (
          <span className="text-sm text-muted-foreground">({comments.length})</span>
        )}
      </div>

      <TicketCommentsPinned
        pinnedComments={pinnedComments}
        pinnedExpanded={pinnedExpanded}
        onToggleExpanded={() => setPinnedExpanded((v) => !v)}
        onTogglePin={onTogglePin}
      />

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
                  onReply={handleReply}
                  onSetEditTarget={setEditTarget}
                  onSetDeleteTargetId={setDeleteTargetId}
                  observeRef={(el) => observeComment(el, comment)}
                  onJumpToComment={handleJumpToComment}
                />
                {isLatest && <CommentReadIndicator comment={comment} />}
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      <TicketCommentsInput
        newComment={newComment}
        submittingComment={submittingComment}
        uploadingFile={uploadingFile}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={onRemoveAttachment}
        onFileUpload={onFileUpload}
        commentsBlocked={commentsBlocked}
        commentsBlockedMessage={commentsBlockedMessage}
        replyToComment={replyToComment}
        onCancelReply={handleCancelReply}
        showEmojiPicker={showEmojiPicker}
        onToggleEmojiPicker={() => setShowEmojiPicker(!showEmojiPicker)}
        emojiPickerRef={emojiPickerRef}
        showMentions={showMentions}
        mentionsRef={mentionsRef}
        filteredUsers={filteredUsers}
        searchingUsers={searchingUsers}
        mentionSearch={mentionSearch}
        textareaRef={textareaRef}
        onTextChange={handleTextChange}
        onCommentChange={handleEditorChange}
        onEmojiClick={handleEmojiClick}
        onMention={handleMention}
        onSubmit={handleSubmit}
        isCustomer={isCustomer}
        hasAssignee={hasAssignee}
        sendingPing={sendingPing}
        onSendPing={onSendPing}
        canUseTemplates={canUseTemplates}
        canUseAI={canUseAI}
        canMarkInternal={canMarkInternal}
        isInternal={commentIsInternal}
        onToggleInternal={onToggleCommentInternal}
      />

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingComment) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить комментарий?</AlertDialogTitle>
            <AlertDialogDescription>
              Комментарий будет удалён без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingComment}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingComment}
              onClick={async (e) => {
                e.preventDefault();
                if (deleteTargetId === null || !onDeleteComment) return;
                try {
                  setDeletingComment(true);
                  await onDeleteComment(deleteTargetId);
                } finally {
                  setDeletingComment(false);
                  setDeleteTargetId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingComment ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editTarget && onEditComment && (
        <EditCommentDialog
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          initialText={editTarget.comment}
          initialCreatedAt={editTarget.created_at || ''}
          onSave={async (data) => {
            const ok = await onEditComment(editTarget.id, data);
            return ok;
          }}
        />
      )}
    </div>
  );
};

export default TicketComments;