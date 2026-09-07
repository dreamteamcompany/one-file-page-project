import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getApiUrl } from '@/utils/api';
import Icon from '@/components/ui/icon';

export interface ServiceTicket {
  id: number;
  title: string;
  createdAt: string | null;
  closedAt: string | null;
  issue: string;
  assignee: string;
  status: string;
}

interface ServiceTicketsRowsProps {
  line: string;
  service: string;
  issue?: string;
  /** Отступ слева, чтобы список встал под своим уровнем вложенности */
  indent?: string;
}

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

/** Список самих заявок внутри раскрытой строки таблицы. */
const ServiceTicketsRows = ({
  line,
  service,
  issue,
  indent = 'pl-[4.5rem]',
}: ServiceTicketsRowsProps) => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<ServiceTicket[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError(false);
      try {
        const qs = new URLSearchParams({
          endpoint: 'topics-analytics',
          drill: 'tickets',
          line,
          service,
        });
        if (issue) qs.set('issue', issue);
        const res = await apiFetch(`${getApiUrl('topics-analytics')}?${qs}`);
        if (!res.ok) throw new Error('bad response');
        const json = await res.json();
        if (!cancelled) setTickets(json.tickets ?? []);
      } catch {
        if (!cancelled) setError(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [line, service, issue]);

  if (error) {
    return (
      <tr className="border-t border-border/30 bg-black/20 [.light_&]:bg-black/[0.04]">
        <td colSpan={2} className={`px-4 py-2 ${indent} text-muted-foreground`}>
          Не удалось загрузить список заявок
        </td>
      </tr>
    );
  }

  if (tickets === null) {
    return (
      <tr className="border-t border-border/30 bg-black/20 [.light_&]:bg-black/[0.04]">
        <td colSpan={2} className={`px-4 py-2 ${indent} text-muted-foreground`}>
          Загружаю заявки…
        </td>
      </tr>
    );
  }

  if (!tickets.length) {
    return (
      <tr className="border-t border-border/30 bg-black/20 [.light_&]:bg-black/[0.04]">
        <td colSpan={2} className={`px-4 py-2 ${indent} text-muted-foreground`}>
          Заявок нет
        </td>
      </tr>
    );
  }

  return (
    <>
      {tickets.map((t) => (
        <tr
          key={t.id}
          onClick={() => navigate(`/tickets/${t.id}`)}
          className="border-t border-border/20 bg-black/30 [.light_&]:bg-black/[0.05] cursor-pointer hover:bg-accent/25 transition-colors"
        >
          <td className={`px-4 py-2 ${indent}`}>
            <span className="flex items-start gap-2">
              <Icon
                name="ExternalLink"
                size={13}
                className="text-muted-foreground shrink-0 mt-1"
              />
              <span className="min-w-0">
                <span className="block truncate">
                  <span className="text-muted-foreground tabular-nums mr-2">
                    №{t.id}
                  </span>
                  {t.title}
                </span>
                <span className="block text-xs text-muted-foreground truncate">
                  {[t.assignee, t.status, t.issue].filter(Boolean).join(' · ')}
                </span>
              </span>
            </span>
          </td>
          <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap align-top">
            {fmt(t.createdAt)}
          </td>
        </tr>
      ))}
    </>
  );
};

export default ServiceTicketsRows;
