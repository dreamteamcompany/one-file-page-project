import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

interface Comment {
  id: number;
  payment_id: number;
  user_id: number;
  username: string;
  full_name: string;
  parent_comment_id: number | null;
  comment_text: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  user_liked: boolean;
}

interface PaymentCommentsProps {
  paymentId: number;
}

const PaymentComments = ({ paymentId }: PaymentCommentsProps) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    loadComments();
  }, [paymentId]);

  const loadComments = async () => {
    try {
      const response = await fetch(
        `https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=comments&payment_id=${paymentId}`,
        {
          headers: { 'X-Auth-Token': token! },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(
        'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=comments',
        {
          method: 'POST',
          headers: {
            'X-Auth-Token': token!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payment_id: paymentId,
            comment_text: newComment,
          }),
        }
      );

      if (response.ok) {
        setNewComment('');
        await loadComments();
        toast({
          title: 'Комментарий добавлен',
        });
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить комментарий',
        variant: 'destructive',
      });
    }
  };

  const handleReply = async (parentId: number) => {
    if (!replyText.trim()) return;

    try {
      const response = await fetch(
        'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=comments',
        {
          method: 'POST',
          headers: {
            'X-Auth-Token': token!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payment_id: paymentId,
            comment_text: replyText,
            parent_comment_id: parentId,
          }),
        }
      );

      if (response.ok) {
        setReplyText('');
        setReplyingTo(null);
        await loadComments();
        toast({
          title: 'Ответ добавлен',
        });
      }
    } catch (err) {
      console.error('Failed to reply:', err);
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить ответ',
        variant: 'destructive',
      });
    }
  };

  const handleLike = async (commentId: number, isLiked: boolean) => {
    try {
      const response = await fetch(
        'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=comment-likes',
        {
          method: isLiked ? 'DELETE' : 'POST',
          headers: {
            'X-Auth-Token': token!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment_id: commentId }),
        }
      );

      if (response.ok) {
        await loadComments();
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const parentComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId: number) => comments.filter(c => c.parent_comment_id === parentId);

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const replies = getReplies(comment.id);

    return (
      <div className={`${isReply ? 'ml-6 sm:ml-12' : ''}`}>
        <div className="flex gap-2 sm:gap-3 group">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center text-xs sm:text-sm font-medium">
              {comment.full_name?.charAt(0) || comment.username.charAt(0).toUpperCase()}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-card border border-white/10 rounded-lg p-2 sm:p-3 mb-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2 mb-1">
                <span className="font-medium text-xs sm:text-sm">{comment.full_name || comment.username}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {new Date(comment.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <p className="text-xs sm:text-sm whitespace-pre-wrap">{comment.comment_text}</p>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 mb-3">
              <button
                onClick={() => handleLike(comment.id, comment.user_liked)}
                className={`flex items-center gap-1 text-[10px] sm:text-xs transition-colors ${
                  comment.user_liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                }`}
              >
                <Icon name={comment.user_liked ? 'Heart' : 'Heart'} size={12} fill={comment.user_liked ? 'currentColor' : 'none'} />
                {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
              </button>

              {!isReply && (
                <button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="text-[10px] sm:text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Ответить
                </button>
              )}
            </div>

            {replyingTo === comment.id && (
              <div className="mb-3">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Напишите ответ..."
                  className="w-full bg-background border border-white/10 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={2}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleReply(comment.id)}
                    disabled={!replyText.trim()}
                    className="px-2 sm:px-3 py-1 bg-primary hover:bg-primary/90 text-white text-xs sm:text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Отправить
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText('');
                    }}
                    className="px-2 sm:px-3 py-1 bg-white/5 hover:bg-white/10 text-xs sm:text-sm rounded-lg transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {replies.length > 0 && (
              <div className="space-y-3 mt-3">
                {replies.map((reply) => (
                  <CommentItem key={reply.id} comment={reply} isReply />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="space-y-3 sm:space-y-4">
          {parentComments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Пока нет комментариев. Будьте первым!
            </p>
          ) : (
            parentComments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))
          )}
        </div>
      </div>

      <div className="border-t border-white/10 p-3 sm:p-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Напишите комментарий..."
          className="w-full bg-background border border-white/10 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          rows={2}
        />
        <button
          onClick={handleAddComment}
          disabled={!newComment.trim()}
          className="mt-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary hover:bg-primary/90 text-white text-xs sm:text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Icon name="Send" size={14} />
          Отправить
        </button>
      </div>
    </div>
  );
};

export default PaymentComments;