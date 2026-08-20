import { Badge } from '@/components/ui/badge';

export const TRIGGER_META: Record<string, { short: string; full: string; className: string }> = {
  no_reply: {
    short: 'Триггер 1',
    full: 'Нет ответа исполнителя',
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
  },
  operator_silent: {
    short: 'Триггер 2',
    full: 'Исполнитель молчит',
    className: 'bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-100',
  },
  customer_waiting: {
    short: 'Триггер 3',
    full: 'Заказчик ждёт ответа',
    className: 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100',
  },
};

interface Props {
  kind: string;
  withText?: boolean;
}

const TriggerBadge = ({ kind, withText = true }: Props) => {
  const meta = TRIGGER_META[kind];
  if (!meta) return <Badge variant="outline">{kind}</Badge>;

  return (
    <Badge variant="outline" className={`font-medium ${meta.className}`}>
      {meta.short}
      {withText && <span className="font-normal ml-1.5">· {meta.full}</span>}
    </Badge>
  );
};

export default TriggerBadge;
