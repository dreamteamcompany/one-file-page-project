import Icon from '@/components/ui/icon';

interface AuditLog {
  id: number;
  action: string;
  username: string;
  changed_fields?: any;
  old_values?: any;
  new_values?: any;
  metadata?: any;
  created_at: string;
}

interface TicketHistoryProps {
  logs: AuditLog[];
  loading?: boolean;
}

const TicketHistory = ({ logs, loading }: TicketHistoryProps) => {
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return 'Plus';
      case 'updated': return 'Edit';
      case 'status_changed': return 'RefreshCw';
      case 'assigned': return 'UserPlus';
      case 'comment_added': return 'MessageSquare';
      case 'approval_sent': return 'Send';
      case 'approved': return 'CheckCircle';
      case 'rejected': return 'XCircle';
      default: return 'Activity';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'text-blue-500';
      case 'updated': return 'text-purple-500';
      case 'status_changed': return 'text-orange-500';
      case 'assigned': return 'text-green-500';
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      case 'approval_sent': return 'text-indigo-500';
      default: return 'text-gray-500';
    }
  };

  const getActionText = (log: AuditLog) => {
    switch (log.action) {
      case 'created':
        return 'создал заявку';
      case 'updated':
        if (log.changed_fields) {
          const fields = Object.keys(log.changed_fields);
          if (fields.length === 1) {
            const field = fields[0];
            const fieldNames: Record<string, string> = {
              title: 'заголовок',
              description: 'описание',
              priority: 'приоритет',
              category: 'категорию',
              department: 'отдел',
              due_date: 'дедлайн'
            };
            return `изменил ${fieldNames[field] || field}`;
          }
          return `изменил ${fields.length} ${fields.length === 2 ? 'поля' : 'полей'}`;
        }
        return 'изменил заявку';
      case 'status_changed':
        if (log.changed_fields?.status) {
          return `изменил статус: ${log.changed_fields.status.old || '—'} → ${log.changed_fields.status.new}`;
        }
        return 'изменил статус';
      case 'assigned':
        if (log.changed_fields?.assigned_to) {
          return `назначил исполнителя: ${log.changed_fields.assigned_to.new || 'не назначен'}`;
        }
        return 'назначил исполнителя';
      case 'comment_added':
        return 'добавил комментарий';
      case 'approval_sent':
        return `отправил на согласование${log.metadata?.approvers ? ' (' + log.metadata.approvers + ')' : ''}`;
      case 'approved':
        return 'согласовал заявку';
      case 'rejected':
        return `отклонил заявку${log.metadata?.comment ? ': ' + log.metadata.comment : ''}`;
      default:
        return log.action;
    }
  };

  const renderChangedFields = (log: AuditLog) => {
    if (!log.changed_fields || Object.keys(log.changed_fields).length === 0) {
      return null;
    }

    const fieldNames: Record<string, string> = {
      title: 'Заголовок',
      description: 'Описание',
      priority: 'Приоритет',
      category: 'Категория',
      department: 'Отдел',
      due_date: 'Дедлайн',
      status: 'Статус',
      assigned_to: 'Исполнитель'
    };

    return (
      <div className="mt-2 ml-8 space-y-1">
        {Object.entries(log.changed_fields).map(([field, change]: [string, any]) => {
          if (field === 'status' || field === 'assigned_to') return null;
          
          const oldValue = change.old || '—';
          const newValue = change.new || '—';
          
          return (
            <div key={field} className="text-xs text-muted-foreground">
              <span className="font-medium">{fieldNames[field] || field}:</span>{' '}
              <span className="line-through opacity-60">{oldValue}</span>
              {' → '}
              <span className="font-medium">{newValue}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Icon name="History" size={48} className="mx-auto mb-2 opacity-30" />
        <p>История изменений пока пуста</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log, index) => (
        <div key={log.id} className="flex gap-3 relative">
          {/* Timeline line */}
          {index < logs.length - 1 && (
            <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
          )}
          
          {/* Icon */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-background border-2 flex items-center justify-center z-10 ${getActionColor(log.action)}`}>
            <Icon name={getActionIcon(log.action)} size={14} />
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">{log.username}</span>
                  {' '}
                  <span className="text-muted-foreground">{getActionText(log)}</span>
                </p>
                {renderChangedFields(log)}
              </div>
              <time className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDateTime(log.created_at)}
              </time>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TicketHistory;