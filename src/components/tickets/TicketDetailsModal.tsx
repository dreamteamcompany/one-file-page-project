import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTicketDetailsLogic } from './useTicketDetailsLogic';
import TicketDetailsModalContent from './TicketDetailsModalContent';
import type { TicketDetailsModalProps } from './TicketDetailsModalTypes';

const TicketDetailsModal = ({ ticket, onClose, statuses = [], onTicketUpdate }: TicketDetailsModalProps) => {
  const {
    comments,
    newComment,
    setNewComment,
    loadingComments,
    submittingComment,
    users,
    updating,
    sendingPing,
    activeTab,
    setActiveTab,
    user,
    handleSubmitComment,
    handleUpdateStatus,
    handleSendPing,
    handleReaction,
    handleAssignUser,
  } = useTicketDetailsLogic(ticket, onTicketUpdate);

  if (!ticket) return null;

  return (
    <Dialog open={!!ticket} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-full h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl">
            Заявка #{ticket.id}: {ticket.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pb-6 overflow-hidden">
          <TicketDetailsModalContent
            ticket={ticket}
            comments={comments}
            newComment={newComment}
            onCommentChange={setNewComment}
            loadingComments={loadingComments}
            submittingComment={submittingComment}
            users={users}
            updating={updating}
            sendingPing={sendingPing}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            userId={user?.id}
            statuses={statuses}
            onSubmitComment={handleSubmitComment}
            onUpdateStatus={handleUpdateStatus}
            onSendPing={handleSendPing}
            onReaction={handleReaction}
            onAssignUser={handleAssignUser}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TicketDetailsModal;