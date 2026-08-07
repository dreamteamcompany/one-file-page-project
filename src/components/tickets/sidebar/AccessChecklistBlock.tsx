import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  useAccessChecklist,
  type AccessChecklistItem,
  type AccessChecklistStatus,
} from '@/hooks/useAccessChecklist';

const STATUS_LABELS: Record<AccessChecklistStatus, string> = {
  pending: 'Не отмечено',
  done: 'Сделано',
  not_applicable: 'Не применимо',
};

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

interface RowProps {
  item: AccessChecklistItem;
  canEdit: boolean;
  saving: boolean;
  onChange: (
    itemId: number,
    status: AccessChecklistStatus,
    comment?: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
}

const ChecklistRow = ({ item, canEdit, saving, onChange }: RowProps) => {
  const { toast } = useToast();
  const [comment, setComment] = useState(item.comment || '');
  const [commentError, setCommentError] = useState('');

  useEffect(() => {
    setComment(item.comment || '');
  }, [item.comment]);

  const apply = async (status: AccessChecklistStatus) => {
    setCommentError('');
    const trimmed = comment.trim();

    if (status === 'not_applicable' && !trimmed) {
      setCommentError('Укажите причину — почему пункт не применим');
      return;
    }

    const result = await onChange(item.id, status, trimmed || null);
    if (!result.ok) {
      setCommentError(result.error || 'Не удалось сохранить');
      toast({
        title: 'Изменение не сохранено',
        description: result.error || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    }
  };

  const saveComment = async () => {
    if (item.status === 'pending') return;
    const trimmed = comment.trim();
    if (trimmed === (item.comment || '')) return;
    if (item.status === 'not_applicable' && !trimmed) {
      setCommentError('Для статуса «Не применимо» комментарий обязателен');
      setComment(item.comment || '');
      return;
    }
    await onChange(item.id, item.status, trimmed || null);
  };

  const isDone = item.status === 'done';
  const isNA = item.status === 'not_applicable';
  const isPending = item.status === 'pending';

  const statusColor = isDone
    ? 'text-green-600'
    : isNA
      ? 'text-amber-600'
      : 'text-muted-foreground';

  return (
    <div className={`p-3 rounded-lg border ${isPending ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-background'}`}>
      <div className="flex items-start gap-2">
        <Icon
          name={isDone ? 'CircleCheck' : isNA ? 'CircleSlash' : 'Circle'}
          size={16}
          className={`mt-0.5 flex-shrink-0 ${statusColor}`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground break-words">{item.service_name}</p>
          <p className={`text-[11px] ${statusColor}`}>{STATUS_LABELS[item.status]}</p>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Button
            type="button"
            size="sm"
            variant={isDone ? 'default' : 'outline'}
            className="h-7 text-xs"
            disabled={saving}
            onClick={() => apply(isDone ? 'pending' : 'done')}
            title={isDone ? 'Снять отметку' : 'Отметить как сделано'}
          >
            <Icon name="Check" size={13} />
            Сделано
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isNA ? 'secondary' : 'outline'}
            className="h-7 text-xs"
            disabled={saving}
            onClick={() => apply(isNA ? 'pending' : 'not_applicable')}
            title={isNA ? 'Снять отметку' : 'Отметить как не применимо'}
          >
            <Icon name="Minus" size={13} />
            Не применимо
          </Button>
        </div>
      )}

      {canEdit && (
        <div className="mt-2">
          <Textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (commentError) setCommentError('');
            }}
            onBlur={saveComment}
            rows={2}
            maxLength={1000}
            disabled={saving}
            placeholder={isNA ? 'Причина обязательна, например: в 1С учётки не было' : 'Комментарий (необязательно)'}
            className="text-xs resize-none"
            aria-label={`Комментарий к пункту «${item.service_name}»`}
          />
          {commentError && (
            <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
              <Icon name="AlertCircle" size={11} />
              {commentError}
            </p>
          )}
        </div>
      )}

      {!canEdit && item.comment && (
        <p className="text-xs text-muted-foreground mt-1.5 break-words">{item.comment}</p>
      )}

      {item.completed_at && (
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <Icon name="User" size={11} />
          {item.completed_by_name || item.completed_by_username || 'Сотрудник'}
          {' · '}
          {formatDateTime(item.completed_at)}
        </p>
      )}
    </div>
  );
};

interface Props {
  ticketId: number;
  /** Текст ошибки, если заявку не удалось закрыть из-за незакрытых пунктов */
  closeError?: string;
}

const AccessChecklistBlock = ({ ticketId, closeError }: Props) => {
  const {
    items,
    required,
    canEdit,
    loading,
    loadError,
    savingId,
    total,
    completed,
    pending,
    reload,
    updateItem,
  } = useAccessChecklist(ticketId);

  if (loading) {
    return (
      <div className="rounded-lg bg-card border p-4">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Icon name="Loader2" size={13} className="animate-spin" />
          Загрузка чек-листа…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg bg-card border p-4">
        <p className="text-xs text-destructive flex items-center gap-2">
          <Icon name="AlertCircle" size={13} />
          {loadError}
        </p>
        <Button size="sm" variant="outline" className="h-7 text-xs mt-2" onClick={reload}>
          Повторить
        </Button>
      </div>
    );
  }

  // Заявителю и заявкам без чек-листа блок не показываем
  if (!required || total === 0) return null;

  const allDone = pending === 0;

  return (
    <div className="rounded-lg bg-card border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
            <Icon name="ShieldOff" size={14} className={allDone ? 'text-green-600' : 'text-amber-600'} />
            Чек-лист блокировки доступов
          </h3>
          <Badge
            variant="secondary"
            className={allDone ? 'bg-green-500/15 text-green-700' : 'bg-amber-500/15 text-amber-700'}
          >
            {completed} из {total}
          </Badge>
        </div>

        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
          />
        </div>

        {!allDone && (
          <p className="text-[11px] text-amber-600 mt-2 flex items-start gap-1">
            <Icon name="AlertTriangle" size={11} className="mt-0.5 flex-shrink-0" />
            Осталось отметить: {pending}. Заявку нельзя закрыть, пока есть неотмеченные пункты
          </p>
        )}

        {closeError && (
          <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-[11px] text-destructive flex items-start gap-1">
              <Icon name="CircleAlert" size={11} className="mt-0.5 flex-shrink-0" />
              {closeError}
            </p>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            canEdit={canEdit}
            saving={savingId === item.id}
            onChange={updateItem}
          />
        ))}
      </div>
    </div>
  );
};

export default AccessChecklistBlock;
