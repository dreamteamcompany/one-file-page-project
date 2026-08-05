/**
 * Правая панель деталей заявки в новом интерфейсе (по эталону).
 * Вкладки: Детали / Комментарии / История / Файлы. Рабочие: статус, исполнитель,
 * комментарии, история, файлы, контакты заявителя. Метки — визуальная заглушка.
 */
import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TicketHistory from '@/components/tickets/TicketHistory';
import TicketFiles from '@/components/tickets/TicketFiles';
import { useTicketData } from '@/hooks/useTicketData';
import { useTicketActions } from '@/hooks/useTicketActions';
import { formatDateMSK, getDeadlineSeverity, getDeadlineLeftLabel } from '@/utils/dateFormat';

interface WorkspaceDetailsPanelProps {
  ticketId: number;
  onClose: () => void;
  onChanged?: () => void;
}

const initials = (name?: string): string => {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
};

const ticketSlug = (id: number): string => {
  const base = (id * 2654435761) >>> 0;
  return base.toString(36).slice(0, 7);
};

const WorkspaceDetailsPanel = ({ ticketId, onClose, onChanged }: WorkspaceDetailsPanelProps) => {
  const { hasPermission } = useAuth();
  const id = String(ticketId);

  const {
    ticket,
    statuses,
    comments,
    executorUsers,
    auditLogs,
    loading,
    loadingComments,
    loadingHistory,
    loadTicket,
    loadComments,
    loadHistory,
  } = useTicketData(id, null);

  const {
    newComment,
    setNewComment,
    submittingComment,
    updating,
    handleSubmitComment,
    handleUpdateStatus,
    handleAssignUser,
  } = useTicketActions(id, async () => { await loadTicket(false); onChanged?.(); }, loadComments, loadHistory);

  const [tab, setTab] = useState('details');
  const [assigneeEdit, setAssigneeEdit] = useState(false);

  const canUpdate = hasPermission('tickets', 'update');
  const severity = useMemo(() => getDeadlineSeverity(ticket?.due_date), [ticket?.due_date]);
  const filesCount = useMemo(
    () => comments.reduce((s, c) => s + (c.attachments?.length || 0), 0),
    [comments]
  );

  // Телефон и подкатегория ищем среди кастомных полей заявки.
  const phoneField = useMemo(
    () => ticket?.custom_fields?.find((f) => f.field_type === 'phone' && f.value),
    [ticket?.custom_fields]
  );
  const subcategoryField = useMemo(
    () => ticket?.custom_fields?.find(
      (f) => /подкатег|subcateg/i.test(f.name) && f.value
    ),
    [ticket?.custom_fields]
  );

  if (loading && !ticket) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-card">
        <Icon name="Loader2" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
        <Icon name="FileQuestion" size={40} className="mb-2" />
        <span>Заявка не найдена</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card shadow-sm">
      {/* Заголовок */}
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">#{ticket.id}</span>
            {ticket.status_name && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {ticket.status_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Назначить исполнителя"
              onClick={() => { setTab('details'); setAssigneeEdit(true); }}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            >
              <Icon name="Shuffle" size={16} />
            </button>
            <button
              type="button"
              title="Действия (скоро)"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            >
              <Icon name="EllipsisVertical" size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Закрыть"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            >
              <Icon name="X" size={18} />
            </button>
          </div>
        </div>

        <h2 className="mt-2 text-lg font-bold text-foreground">{ticket.title}</h2>
        <div className="mt-0.5 font-mono text-xs text-muted-foreground">{ticketSlug(ticket.id)}</div>

        {/* Мини-теги (заглушка) */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {ticket.category_name && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {ticket.category_name}
            </span>
          )}
          {ticket.department_name && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {ticket.department_name}
            </span>
          )}
          <button
            type="button"
            title="Добавить (скоро)"
            className="flex h-5 w-5 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted"
          >
            <Icon name="Plus" size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4">
        {/* Метрики */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Создано</div>
            <div className="mt-0.5 font-medium text-foreground">{formatDateMSK(ticket.created_at)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Обновлено</div>
            <div className="mt-0.5 font-medium text-foreground">{formatDateMSK(ticket.updated_at)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">SLA</div>
            <div className="mt-0.5 font-medium text-foreground">
              {ticket.due_date ? getDeadlineLeftLabel(ticket.due_date) : '—'}
            </div>
          </div>
        </div>
        {severity && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${severity.percent}%`, backgroundColor: severity.color }}
            />
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="details">Детали</TabsTrigger>
            <TabsTrigger value="comments">Комментарии {comments.length > 0 ? comments.length : ''}</TabsTrigger>
            <TabsTrigger value="history">История</TabsTrigger>
            <TabsTrigger value="files">Файлы {filesCount > 0 ? filesCount : ''}</TabsTrigger>
          </TabsList>

          {/* Детали */}
          <TabsContent value="details" className="mt-4 space-y-5">
            {/* Заявитель */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Заявитель</div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={ticket.creator_photo_url} />
                    <AvatarFallback>{initials(ticket.creator_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{ticket.creator_name || '—'}</div>
                    {ticket.creator_email && (
                      <div className="truncate text-xs text-muted-foreground">{ticket.creator_email}</div>
                    )}
                    {phoneField && (
                      <div className="truncate text-xs text-muted-foreground">{phoneField.value}</div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {ticket.creator_email && (
                    <a
                      href={`mailto:${ticket.creator_email}`}
                      title="Написать письмо"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                    >
                      <Icon name="Mail" size={15} />
                    </a>
                  )}
                  {phoneField && (
                    <a
                      href={`tel:${phoneField.value.replace(/[^\d+]/g, '')}`}
                      title="Позвонить"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                    >
                      <Icon name="Phone" size={15} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Исполнитель */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Исполнитель</span>
                {canUpdate && !assigneeEdit && (
                  <button
                    type="button"
                    onClick={() => setAssigneeEdit(true)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Изменить
                  </button>
                )}
              </div>
              {assigneeEdit ? (
                <Select
                  value={ticket.assigned_to ? String(ticket.assigned_to) : 'unassign'}
                  onValueChange={(v) => { if (canUpdate) { handleAssignUser(v); setAssigneeEdit(false); } }}
                  disabled={!canUpdate || updating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassign">Не назначен</SelectItem>
                    {executorUsers.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={ticket.assignee_photo_url} />
                    <AvatarFallback>{initials(ticket.assignee_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {ticket.assignee_name || 'Не назначен'}
                    </div>
                    {ticket.department_name && (
                      <div className="truncate text-xs text-muted-foreground">{ticket.department_name}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Приоритет / Статус */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Приоритет</div>
                <div className="rounded-lg border border-border px-3 py-2 text-sm text-foreground truncate">
                  {ticket.priority_name || '—'}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Статус</div>
                <Select
                  value={ticket.status_id ? String(ticket.status_id) : undefined}
                  onValueChange={(v) => canUpdate && handleUpdateStatus(Number(v))}
                  disabled={!canUpdate || updating}
                >
                  <SelectTrigger className="h-[38px]">
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Категория */}
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Категория</div>
              <div className="rounded-lg border border-border px-3 py-2 text-sm text-foreground truncate">
                {ticket.category_name || '—'}
              </div>
            </div>

            {/* Подкатегория (если есть в кастомных полях) */}
            {subcategoryField && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Подкатегория</div>
                <div className="rounded-lg border border-border px-3 py-2 text-sm text-foreground truncate">
                  {subcategoryField.value}
                </div>
              </div>
            )}

            {/* Метки (заглушка) */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Метки</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Помощь</span>
                <button
                  type="button"
                  title="Скоро"
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  <Icon name="Plus" size={12} />
                  Добавить метку
                </button>
              </div>
            </div>

            {ticket.description && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Описание</div>
                <div className="whitespace-pre-wrap rounded-lg border border-border p-3 text-sm text-foreground">
                  {ticket.description}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Комментарии */}
          <TabsContent value="comments" className="mt-4">
            {loadingComments ? (
              <div className="flex items-center justify-center py-8">
                <Icon name="Loader2" size={24} className="animate-spin text-primary" />
              </div>
            ) : comments.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Пока нет комментариев</div>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={c.user_photo_url} />
                      <AvatarFallback className="text-[10px]">
                        {initials(c.user_full_name || c.user_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {c.user_full_name || c.user_name || 'Пользователь'}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDateMSK(c.created_at)}</span>
                      </div>
                      <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{c.comment}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* История */}
          <TabsContent value="history" className="mt-4">
            <TicketHistory logs={auditLogs} loading={loadingHistory} />
          </TabsContent>

          {/* Файлы */}
          <TabsContent value="files" className="mt-4">
            <TicketFiles comments={comments} />
          </TabsContent>
        </Tabs>
      </div>
      </div>

      {/* Быстрые действия — отдельная карточка */}
      <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Быстрые действия</div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('comments')}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
          >
            <Icon name="Reply" size={13} />
            Ответить
          </button>
          <button
            type="button"
            onClick={() => setTab('comments')}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
          >
            <Icon name="MessageSquare" size={13} />
            Комментарий
          </button>
          <button
            type="button"
            onClick={() => setTab('details')}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
          >
            <Icon name="RefreshCw" size={13} />
            Изменить статус
          </button>
        </div>
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Напишите комментарий..."
              rows={2}
              className="resize-none pr-16"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button
                type="button"
                title="Прикрепить файл (скоро)"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <Icon name="Paperclip" size={15} />
              </button>
              <button
                type="button"
                title="Эмодзи"
                onClick={() => setNewComment(newComment + ' 🙂')}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <Icon name="Smile" size={15} />
              </button>
            </div>
          </div>
          <Button
            size="icon"
            disabled={submittingComment || !newComment.trim()}
            onClick={() => handleSubmitComment()}
            title={submittingComment ? 'Отправка…' : 'Отправить комментарий'}
            aria-label={submittingComment ? 'Отправка комментария' : 'Отправить комментарий'}
          >
            {submittingComment ? (
              <Icon name="Loader2" size={18} className="animate-spin" />
            ) : (
              <Icon name="Send" size={18} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceDetailsPanel;