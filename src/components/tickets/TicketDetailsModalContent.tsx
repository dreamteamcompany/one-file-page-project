import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import TicketDetailsHeader from './TicketDetailsHeader';
import TicketDetailsInfo from './TicketDetailsInfo';
import TicketDetailsSidebar from './TicketDetailsSidebar';
import TicketComments from './TicketComments';
import type { Ticket, Comment, User, Status } from './TicketDetailsModalTypes';

interface TicketDetailsModalContentProps {
  ticket: Ticket;
  comments: Comment[];
  newComment: string;
  onCommentChange: (value: string) => void;
  loadingComments: boolean;
  submittingComment: boolean;
  users: User[];
  updating: boolean;
  sendingPing: boolean;
  activeTab: 'info' | 'tasks' | 'related' | 'sla';
  onTabChange: (tab: 'info' | 'tasks' | 'related' | 'sla') => void;
  userId?: number;
  statuses: Status[];
  onSubmitComment: (files?: File[]) => void;
  onUpdateStatus: (statusId: string) => void;
  onSendPing: () => void;
  onReaction: (commentId: number, emoji: string) => void;
  onAssignUser: (userId: string) => void;
}

const TicketDetailsModalContent = ({
  ticket,
  comments,
  newComment,
  onCommentChange,
  loadingComments,
  submittingComment,
  users,
  updating,
  sendingPing,
  activeTab,
  onTabChange,
  userId,
  statuses,
  onSubmitComment,
  onUpdateStatus,
  onSendPing,
  onReaction,
  onAssignUser,
}: TicketDetailsModalContentProps) => {

  return (
    <div className="flex gap-6 max-h-[80vh] overflow-hidden">
      <div className="flex-1 overflow-y-auto pr-4">
        <TicketDetailsHeader
          ticket={ticket}
          statuses={statuses}
          onStatusUpdate={onUpdateStatus}
          updating={updating}
        />

        <div className="mt-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Icon name="FileText" size={18} />
              Описание
            </h3>
            <TicketDetailsInfo ticket={ticket} />
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="MessageSquare" size={18} />
              Комментарии
              <Badge variant="secondary">{comments.length}</Badge>
            </h3>
            <TicketComments
              comments={comments}
              loadingComments={loadingComments}
              newComment={newComment}
              submittingComment={submittingComment}
              onCommentChange={onCommentChange}
              onSubmitComment={onSubmitComment}
              isCustomer={ticket.created_by === userId}
              hasAssignee={!!ticket.assigned_to}
              sendingPing={sendingPing}
              onSendPing={onSendPing}
              currentUserId={userId}
              onReaction={onReaction}
              availableUsers={users}
            />
          </div>
        </div>
      </div>

      <TicketDetailsSidebar
        ticket={ticket}
        statuses={statuses}
        users={users}
        updating={updating}
        onUpdateStatus={onUpdateStatus}
        onAssignUser={onAssignUser}
      />
    </div>
  );
};

export default TicketDetailsModalContent;