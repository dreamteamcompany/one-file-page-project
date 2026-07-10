import { Badge } from '@/components/ui/badge';

interface AutomationStatusBadgeProps {
  status: string | null;
}

const AutomationStatusBadge = ({ status }: AutomationStatusBadgeProps) => {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    success: { label: 'Успешно', cls: 'bg-green-500/15 text-green-500 border-green-500/30' },
    error: { label: 'Ошибка', cls: 'bg-red-500/15 text-red-500 border-red-500/30' },
    running: { label: 'Выполняется', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  };
  const info = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <Badge variant="outline" className={info.cls}>{info.label}</Badge>;
};

export default AutomationStatusBadge;
