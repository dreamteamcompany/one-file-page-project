import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import TicketApprovalBlock from './TicketApprovalBlock';
import TicketTimerCard from './sidebar/TicketTimerCard';
import TicketPingCard from './sidebar/TicketPingCard';
import TicketInfoFields from './sidebar/TicketInfoFields';
import TicketWatchersBlock from './sidebar/TicketWatchersBlock';
import AssignmentSection from './sidebar/ticket-info/AssignmentSection';
import type { Ticket as AssignTicket, User as AssignUser, ExecutorGroup as AssignGroup } from './sidebar/ticket-info/types';
import ApprovalDialog from './sidebar/ApprovalDialog';
import RecentTicketsBlock from './sidebar/RecentTicketsBlock';
import TicketGroupBudget from './sidebar/TicketGroupBudget';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Status {
  id: number;
  name: string;
  color: string;
  is_closed: boolean;
  is_approval?: boolean;
  is_pending_confirmation?: boolean;
  is_reopened?: boolean;
  is_in_progress?: boolean;
  is_paused?: boolean;
  is_waiting_response?: boolean;
}

interface ExecutorGroup {
  id: number;
  name: string;
}

interface Ticket {
  id: number;
  title: string;
  description?: string;
  category_name?: string;
  category_icon?: string;
  priority_id?: number;
  priority_name?: string;
  priority_color?: string;
  status_id?: number;
  status_name?: string;
  status_color?: string;
  department_name?: string;
  created_by: number;
  creator_name?: string;
  creator_email?: string;
  assigned_to?: number;
  assignee_name?: string;
  assignee_email?: string;
  assignee_photo_url?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  confirmation_sent_at?: string;
  rating?: number;
  rejection_reason?: string;
  executor_group_id?: number;
  executor_group_name?: string;
  ticket_service?: {
    id: number;
    name: string;
  };
  services?: Array<{
    id: number;
    name: string;
    category_name?: string;
  }>;
}

interface TicketDetailsSidebarProps {
  ticket: Ticket;
  statuses: Status[];
  users: User[];
  executorUsers?: User[];
  updating: boolean;
  sendingPing?: boolean;
  isCustomer?: boolean;
  hasAssignee?: boolean;
  executorGroups?: ExecutorGroup[];
  onUpdateStatus: (statusId: string) => void;
  onAssignUser: (userId: string) => void;
  onAssignGroup?: (groupId: string) => void;
  onSendPing?: () => void;
  onApprovalChange?: () => void;
  onUpdateDueDate?: (dueDate: string | null) => void;
  hidePing?: boolean;
  onReopened?: () => void;
}

const TicketDetailsSidebar = ({
  ticket,
  statuses,
  users,
  executorUsers,
  updating,
  sendingPing = false,
  isCustomer = false,
  hasAssignee = false,
  executorGroups = [],
  onUpdateStatus,
  onAssignUser,
  onAssignGroup,
  onSendPing,
  onApprovalChange,
  onUpdateDueDate,
  hidePing = false,
  onReopened,
}: TicketDetailsSidebarProps) => {
  const { hasPermission, hasSystemRole } = useAuth();
  const canSeeGroup = hasSystemRole('admin', 'executor');
  const canAssignExecutor = hasPermission('tickets', 'assign_executor');
  const canEditApprovers = hasPermission('tickets', 'edit_approvers');

  const currentStatus = statuses.find(s => s.id === ticket.status_id);
  const statusIsPendingConfirmation =
    ticket.status_is_pending_confirmation ?? !!currentStatus?.is_pending_confirmation;
  const isTimerPaused = !!(
    (ticket.status_is_closed ?? currentStatus?.is_closed) ||
    currentStatus?.is_paused ||
    (ticket.status_is_waiting_response ?? currentStatus?.is_waiting_response) ||
    statusIsPendingConfirmation
  );

  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [selectedApprovers, setSelectedApprovers] = useState<number[]>([]);
  
  const handleStatusChange = (statusId: string) => {
    const status = statuses.find(s => s.id.toString() === statusId);
    if (status?.is_approval) {
      if (!canEditApprovers) return;
      setPendingStatusId(statusId);
      setShowApprovalDialog(true);
    } else {
      onUpdateStatus(statusId);
    }
  };
  
  const handleApprovalConfirm = async () => {
    if (!pendingStatusId) return;
    
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      
      await onUpdateStatus(pendingStatusId);
      
      if (selectedApprovers.length > 0) {
        const { apiFetch, API_URL } = await import('@/utils/api');
        await apiFetch(`${API_URL}?endpoint=ticket-approvals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token || '',
          },
          body: JSON.stringify({
            ticket_id: ticket.id,
            approver_ids: selectedApprovers,
          }),
        });
      }
      
      setShowApprovalDialog(false);
      setPendingStatusId(null);
      setSelectedApprovers([]);
    } catch (error) {
      console.error('Error confirming approval:', error);
    }
  };
  
  const toggleApprover = (userId: number) => {
    setSelectedApprovers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleApprovalCancel = () => {
    setShowApprovalDialog(false);
    setPendingStatusId(null);
    setSelectedApprovers([]);
  };

  return (
    <>
      <div className="w-full lg:w-[400px] space-y-3 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
          <TicketTimerCard dueDate={ticket.due_date} paused={isTimerPaused} />
          {!hidePing && <TicketPingCard onSendPing={onSendPing} sendingPing={sendingPing} />}
        </div>

        <TicketGroupBudget ticketId={ticket.id} />

        <TicketInfoFields
          ticket={ticket}
          statuses={statuses}
          users={users}
          updating={updating}
          isCustomer={isCustomer}
          executorGroups={executorGroups}
          isPendingConfirmation={statusIsPendingConfirmation}
          onStatusChange={handleStatusChange}
          onAssignUser={onAssignUser}
          onAssignGroup={onAssignGroup}
          onUpdateDueDate={onUpdateDueDate}
          onConfirmationChanged={onApprovalChange || (() => {})}
          onReopened={onReopened}
        />

        {/* Объединённый блок: Группа исполнителей, Исполнитель, Наблюдатели, Согласующие */}
        <div className="rounded-lg bg-card border divide-y">
          <AssignmentSection
            ticket={ticket as AssignTicket}
            users={(executorUsers ?? users) as AssignUser[]}
            updating={updating}
            executorGroups={executorGroups as AssignGroup[]}
            canSeeGroup={canSeeGroup}
            canAssignExecutor={canAssignExecutor}
            onAssignUser={onAssignUser}
            onAssignGroup={onAssignGroup}
          />
          <TicketWatchersBlock
            ticketId={ticket.id}
            availableUsers={users}
          />
          <TicketApprovalBlock
            ticketId={ticket.id}
            statusName={ticket.status_name || ''}
            onStatusChange={onApprovalChange || (() => {})}
            availableUsers={users}
          />
        </div>

        <RecentTicketsBlock
          ticketId={ticket.id}
          createdBy={ticket.created_by}
        />
      </div>
      
      <ApprovalDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        users={users}
        selectedApprovers={selectedApprovers}
        onToggleApprover={toggleApprover}
        onConfirm={handleApprovalConfirm}
        onCancel={handleApprovalCancel}
      />
    </>
  );
};

export default TicketDetailsSidebar;