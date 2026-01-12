import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
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
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  custom_fields?: CustomField[];
}

interface TicketDetailsInfoProps {
  ticket: Ticket;
}

const TicketDetailsInfo = ({ ticket }: TicketDetailsInfoProps) => {
  return (
    <div className="space-y-6">
      {ticket.description && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <Icon name="FileText" size={16} />
            Описание
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {ticket.custom_fields && ticket.custom_fields.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <Icon name="Settings" size={16} />
            Дополнительные поля
          </h3>
          <div className="space-y-3">
            {ticket.custom_fields.map((field) => (
              <div key={field.id} className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{field.name}</p>
                <p className="text-sm">{field.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetailsInfo;