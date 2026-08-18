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
import { Comment, TicketCommentsProps } from './TicketCommentsTypes';

interface TicketCommentsDialogsProps {
  deleteTargetId: number | null;
  setDeleteTargetId: (id: number | null) => void;
  deletingComment: boolean;
  setDeletingComment: (v: boolean) => void;
  onDeleteComment?: TicketCommentsProps['onDeleteComment'];
  editTarget: Comment | null;
  setEditTarget: (comment: Comment | null) => void;
  onEditComment?: TicketCommentsProps['onEditComment'];
}

const TicketCommentsDialogs = ({
  deleteTargetId,
  setDeleteTargetId,
  deletingComment,
  setDeletingComment,
  onDeleteComment,
  editTarget,
  setEditTarget,
  onEditComment,
}: TicketCommentsDialogsProps) => {
  return (
    <>
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
    </>
  );
};

export default TicketCommentsDialogs;