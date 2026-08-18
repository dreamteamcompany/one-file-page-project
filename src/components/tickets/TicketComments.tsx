import Icon from '@/components/ui/icon';
import { TicketCommentsProps } from './TicketCommentsTypes';
import TicketCommentsPinned from './TicketCommentsPinned';
import TicketCommentsInput from './TicketCommentsInput';
import TicketCommentsList from './TicketCommentsList';
import TicketCommentsDialogs from './TicketCommentsDialogs';
import { useTicketCommentsLogic } from './useTicketCommentsLogic';

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
  const {
    showEmojiPicker,
    setShowEmojiPicker,
    replyToComment,
    showMentions,
    mentionSearch,
    pinnedExpanded,
    setPinnedExpanded,
    deleteTargetId,
    setDeleteTargetId,
    deletingComment,
    setDeletingComment,
    editTarget,
    setEditTarget,
    pinnedComments,
    textareaRef,
    emojiPickerRef,
    mentionsRef,
    commentsEndRef,
    commentsListRef,
    latestCommentId,
    feedItems,
    firstNewIndex,
    observeComment,
    getReadStatus,
    handleEmojiClick,
    handleReply,
    handleCancelReply,
    handleMention,
    handleTextChange,
    handleEditorChange,
    searchingUsers,
    filteredUsers,
    handleSubmit,
    getParentComment,
    handleJumpToComment,
  } = useTicketCommentsLogic({
    comments,
    loadingComments,
    newComment,
    onCommentChange,
    onSubmitComment,
    currentUserId,
    availableUsers,
    participantIds,
    myLastSeenAt,
    onMarkRead,
  });

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

      <TicketCommentsList
        commentsListRef={commentsListRef}
        commentsEndRef={commentsEndRef}
        loadingComments={loadingComments}
        feedItems={feedItems}
        firstNewIndex={firstNewIndex}
        latestCommentId={latestCommentId}
        currentUserId={currentUserId}
        availableUsers={availableUsers}
        canEditComments={canEditComments}
        canDeleteComments={canDeleteComments}
        onTogglePin={onTogglePin}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
        onReply={handleReply}
        onSetEditTarget={setEditTarget}
        onSetDeleteTargetId={setDeleteTargetId}
        observeComment={observeComment}
        onJumpToComment={handleJumpToComment}
        getParentComment={getParentComment}
        getReadStatus={getReadStatus}
      />

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

      <TicketCommentsDialogs
        deleteTargetId={deleteTargetId}
        setDeleteTargetId={setDeleteTargetId}
        deletingComment={deletingComment}
        setDeletingComment={setDeletingComment}
        onDeleteComment={onDeleteComment}
        editTarget={editTarget}
        setEditTarget={setEditTarget}
        onEditComment={onEditComment}
      />
    </div>
  );
};

export default TicketComments;
