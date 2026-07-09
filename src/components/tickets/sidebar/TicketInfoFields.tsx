import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, API_URL } from '@/utils/api';
import { getDeadlineInfo } from './ticket-info/types';
import { formatDateOnlyMSK } from '@/utils/dateFormat';
import type { Ticket, Status, User, ExecutorGroup } from './ticket-info/types';
import DeadlineSection from './ticket-info/DeadlineSection';


interface TicketInfoFieldsProps {
  ticket: Ticket;
  statuses: Status[];
  users: User[];
  updating: boolean;
  isCustomer?: boolean;
  executorGroups?: ExecutorGroup[];
  isPendingConfirmation?: boolean;
  onStatusChange: (statusId: string) => void;
  onAssignUser: (userId: string) => void;
  onAssignGroup?: (groupId: string) => void;
  onUpdateDueDate?: (dueDate: string | null) => void;
  onConfirmationChanged?: () => void;
  onReopened?: () => void;
}

const TicketInfoFields = ({
  ticket,
  statuses,
  users,
  updating,
  isCustomer = false,
  executorGroups = [],
  isPendingConfirmation = false,
  onStatusChange,
  onAssignUser,
  onAssignGroup,
  onUpdateDueDate,
  onConfirmationChanged,
  onReopened,
}: TicketInfoFieldsProps) => {
  const { hasPermission, hasSystemRole, user, token } = useAuth();
  const canEditDueDate = hasPermission('tickets', 'edit_deadline') || hasSystemRole('admin');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const isAssignee = user?.id === ticket.assigned_to;

  const sendForConfirmation = async () => {
    setConfirmLoading(true);
    try {
      const res = await apiFetch(`${API_URL}?endpoint=ticket-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({ ticket_id: ticket.id }),
      });
      if (res.ok) onConfirmationChanged?.();
    } finally {
      setConfirmLoading(false);
    }
  };

  const currentStatus = statuses.find((s) => s.id === ticket.status_id);
  const canSendForConfirmation =
    !!currentStatus?.is_in_progress ||
    !!currentStatus?.is_approved ||
    !!currentStatus?.is_reopened;

  const deadlineInfo = getDeadlineInfo(ticket.due_date);
  const responseDeadlineInfo = getDeadlineInfo(ticket.response_due_date);

  const currentStatusInList =
    ticket.status_id != null &&
    statuses.some((s) => s.id === ticket.status_id);
  const statusOptions =
    ticket.status_id != null && !currentStatusInList
      ? [
          {
            id: ticket.status_id,
            name: ticket.status_name || 'Текущий статус',
            color: ticket.status_color || '#94a3b8',
            is_closed: false,
            disabled: true,
          } as Status & { disabled?: boolean },
          ...statuses,
        ]
      : statuses;

  return (
    <div className="rounded-lg bg-card border divide-y">
      {ticket.priority_name && (
        <div className="p-4">
          <h3 className="text-xs font-semibold mb-3 text-foreground uppercase tracking-wide flex items-center gap-2">
            <Icon name="Flag" size={14} />
            Приоритет
          </h3>
          <div className="flex items-center gap-2">
            <Badge
              style={{ 
                backgroundColor: `${ticket.priority_color}20`,
                color: ticket.priority_color,
                borderColor: ticket.priority_color
              }}
              className="border"
            >
              {ticket.priority_name}
            </Badge>
          </div>
        </div>
      )}

      <div className="p-4">
        <h3 className="text-xs font-semibold mb-3 text-foreground uppercase tracking-wide flex items-center gap-2">
          <Icon name="CheckCircle" size={14} />
          Статус
        </h3>
        <Select
          value={ticket.status_id?.toString()}
          onValueChange={onStatusChange}
          disabled={updating}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите статус" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem
                key={status.id}
                value={status.id.toString()}
                disabled={(status as { disabled?: boolean }).disabled}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  {status.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>


      </div>

      <DeadlineSection
        ticket={ticket}
        deadlineInfo={deadlineInfo}
        responseDeadlineInfo={responseDeadlineInfo}
        isCustomer={isCustomer}
        canEditDueDate={canEditDueDate}
        onUpdateDueDate={onUpdateDueDate}
      />

      {ticket.category_name && (
        <div className="p-4">
          <h3 className="text-xs font-semibold mb-3 text-foreground uppercase tracking-wide flex items-center gap-2">
            <Icon name="Tag" size={14} />
            Категория
          </h3>
          <div className="flex items-center gap-2">
            {ticket.category_icon && (
              <Icon name={ticket.category_icon} size={14} className="text-primary" />
            )}
            <p className="text-sm">{ticket.category_name}</p>
          </div>
        </div>
      )}

      {ticket.department_name && (
        <div className="p-4">
          <h3 className="text-xs font-semibold mb-3 text-foreground uppercase tracking-wide flex items-center gap-2">
            <Icon name="Building2" size={14} />
            Департамент
          </h3>
          <p className="text-sm">{ticket.department_name}</p>
        </div>
      )}

      {isAssignee && isPendingConfirmation && (
        <div className="p-4 bg-orange-500/10">
          <h3 className="text-xs font-semibold mb-1 text-orange-400 uppercase tracking-wide flex items-center gap-2">
            <Icon name="Clock" size={14} />
            Ожидает подтверждения
          </h3>
          <p className="text-xs text-muted-foreground">
            Заявка отправлена заказчику на проверку.
            {ticket.confirmation_sent_at && (
              <> Отправлено {formatDateOnlyMSK(ticket.confirmation_sent_at)}.</>
            )}
          </p>
        </div>
      )}

      {isAssignee && canSendForConfirmation && !isPendingConfirmation && !ticket.rating && (
        <div className="p-4">
          <h3 className="text-xs font-semibold mb-3 text-foreground uppercase tracking-wide flex items-center gap-2">
            <Icon name="CheckCheck" size={14} />
            Готово к сдаче?
          </h3>
          {ticket.rejection_reason && (
            <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/30">
              <p className="text-xs text-red-400 font-medium mb-0.5">Причина возврата:</p>
              <p className="text-xs text-muted-foreground">{ticket.rejection_reason}</p>
            </div>
          )}
          <Button
            size="lg"
            disabled={confirmLoading}
            onClick={sendForConfirmation}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-base shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            {confirmLoading ? (
              <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
            ) : (
              <Icon name="Send" size={18} className="mr-2" />
            )}
            Отправить на подтверждение
          </Button>
        </div>
      )}

      {ticket.rating && (
        <div className="p-4">
          <h3 className="text-xs font-semibold mb-3 text-foreground uppercase tracking-wide flex items-center gap-2">
            <Icon name="Star" size={14} />
            Оценка заказчика
          </h3>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className="text-xl" style={{ color: star <= ticket.rating! ? '#f59e0b' : '#374151' }}>
                ★
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default TicketInfoFields;