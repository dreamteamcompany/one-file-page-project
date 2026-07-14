import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { API_URL, CLASSIFY_TICKET_URL, apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

interface TicketRow {
  id: number;
  title: string;
  description: string;
}

interface AddExistingTicketsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

type ScopeType = 'active' | 'hidden' | 'archived';

const AddExistingTicketsDialog = ({ open, onOpenChange, onDone }: AddExistingTicketsDialogProps) => {
  const { toast } = useToast();
  const [scope, setScope] = useState<ScopeType>('active');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searched, setSearched] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    setSearched(true);
    let url = `${API_URL}?endpoint=tickets&page=1&limit=50`;
    if (scope === 'hidden') url += '&is_hidden=true';
    if (scope === 'archived') url += '&is_archived=true';
    if (search.trim()) url += `&search_content=${encodeURIComponent(search.trim())}`;

    try {
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      } else {
        setTickets([]);
      }
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === tickets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tickets.map(t => t.id)));
    }
  };

  const handleSend = async () => {
    const chosen = tickets.filter(t => selected.has(t.id));
    if (chosen.length === 0) {
      toast({ title: 'Выберите заявки', variant: 'destructive' });
      return;
    }
    setSending(true);
    let ok = 0;
    for (const t of chosen) {
      const text = (t.description || t.title || '').trim();
      if (!text) continue;
      try {
        const res = await apiFetch(CLASSIFY_TICKET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: text, source_ticket_id: t.id, queue_only: true }),
        });
        if (res.ok) ok += 1;
      } catch {
        /* ignore single failure */
      }
    }
    setSending(false);
    toast({ title: `Отправлено на обучение: ${ok}` });
    setSelected(new Set());
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Добавить заявки для обучения</DialogTitle>
          <DialogDescription>
            Выберите существующие заявки — ИИ проанализирует их и добавит на проверку.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Select value={scope} onValueChange={v => setScope(v as ScopeType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Активные</SelectItem>
              <SelectItem value="hidden">Скрытые</SelectItem>
              <SelectItem value="archived">Архив</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadTickets()}
            placeholder="Поиск по тексту заявки"
            className="flex-1"
          />
          <Button onClick={loadTickets} disabled={loading} className="gap-2">
            <Icon name="Search" size={16} />
            Найти
          </Button>
        </div>

        {searched && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Найдено: {tickets.length}</span>
            {tickets.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={toggleAll}>
                {selected.size === tickets.length ? 'Снять все' : 'Выбрать все'}
              </Button>
            )}
          </div>
        )}

        <ScrollArea className="h-72 rounded-md border">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Загрузка…</div>
          ) : tickets.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {searched ? 'Заявки не найдены' : 'Нажмите «Найти», чтобы загрузить заявки'}
            </div>
          ) : (
            <div className="divide-y">
              {tickets.map(t => (
                <label
                  key={t.id}
                  className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selected.has(t.id)}
                    onCheckedChange={() => toggle(t.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">#{t.id}</Badge>
                      <span className="text-sm font-medium truncate">{t.title || 'Без темы'}</span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {t.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-between items-center pt-1">
          <span className="text-xs text-muted-foreground">Выбрано: {selected.size}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={handleSend} disabled={sending || selected.size === 0} className="gap-2">
              {sending ? (
                <Icon name="Loader2" size={16} className="animate-spin" />
              ) : (
                <Icon name="Sparkles" size={16} />
              )}
              Отправить на обучение
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddExistingTicketsDialog;
