import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SlaGroupBudgets, { GroupBudgetItem } from '@/components/sla/SlaGroupBudgets';
import { useState } from 'react';
import { InlineTimeInput } from './SlaTimeInputs';
import {
  PriorityTime,
  SLAItem,
  SLAFormData,
  TicketPriority,
  TicketStatus,
} from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSla: SLAItem | null;
  formData: SLAFormData;
  setFormData: (data: SLAFormData) => void;
  statuses: TicketStatus[];
  priorities: TicketPriority[];
  priorityTimes: PriorityTime[];
  priorityTimesEnabled: boolean;
  onPriorityTimesToggle: (checked: boolean) => void;
  updatePriorityTime: (priorityId: number, updates: Partial<PriorityTime>) => void;
  addPriorityTime: (priorityId: number) => void;
  removePriorityTime: (priorityId: number) => void;
  availablePriorities: TicketPriority[];
  groupBudgets: GroupBudgetItem[];
  setGroupBudgets: (budgets: GroupBudgetItem[]) => void;
  onGroupBudgetsValidChange?: (valid: boolean) => void;
  groupBudgetsValid?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

const SlaFormDialog = ({
  open,
  onOpenChange,
  editingSla,
  formData,
  setFormData,
  statuses,
  priorities,
  priorityTimes,
  priorityTimesEnabled,
  onPriorityTimesToggle,
  updatePriorityTime,
  addPriorityTime,
  removePriorityTime,
  availablePriorities,
  groupBudgets,
  setGroupBudgets,
  onGroupBudgetsValidChange,
  groupBudgetsValid = true,
  onSubmit,
  onClose,
}: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSla ? 'Редактировать SLA' : 'Создать SLA'}</DialogTitle>
          <DialogDescription>
            Настройте параметры соглашения об уровне обслуживания
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название SLA</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Например: Стандартный SLA"
              required
            />
          </div>

          <Tabs defaultValue="timing" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="timing" className="text-xs sm:text-sm">
                <Icon name="Timer" size={14} className="mr-1.5 hidden sm:inline" />
                Сроки
              </TabsTrigger>
              <TabsTrigger value="priorities" className="text-xs sm:text-sm">
                <Icon name="Layers" size={14} className="mr-1.5 hidden sm:inline" />
                Приоритеты
              </TabsTrigger>
              <TabsTrigger value="groups" className="text-xs sm:text-sm">
                <Icon name="Users" size={14} className="mr-1.5 hidden sm:inline" />
                Группы
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm">
                <Icon name="Settings" size={14} className="mr-1.5 hidden sm:inline" />
                Настройки
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timing" className="space-y-3 mt-4">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="Timer" size={15} className="text-primary" />
                  <h3 className="text-sm font-semibold">Время реакции</h3>
                </div>
                <div className="divide-y divide-border/50">
                  <InlineTimeInput
                    label="Макс. время реакции"
                    value={formData.response_time_minutes}
                    onChange={(minutes) => setFormData({ ...formData, response_time_minutes: minutes })}
                    description="Максимальное время для первого ответа на заявку"
                  />
                  <InlineTimeInput
                    label="Уведомление о сроке"
                    value={formData.response_notification_minutes}
                    onChange={(minutes) => setFormData({ ...formData, response_notification_minutes: minutes })}
                    description="За сколько до окончания времени реакции отправить уведомление"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="CheckCircle2" size={15} className="text-green-500" />
                  <h3 className="text-sm font-semibold">Время решения</h3>
                </div>
                <div className="divide-y divide-border/50">
                  <InlineTimeInput
                    label="Макс. время решения"
                    value={formData.resolution_time_minutes}
                    onChange={(minutes) => setFormData({ ...formData, resolution_time_minutes: minutes })}
                    description="Максимальное время для полного решения заявки"
                  />
                  <InlineTimeInput
                    label="Уведомление о сроке"
                    value={formData.resolution_notification_minutes}
                    onChange={(minutes) => setFormData({ ...formData, resolution_notification_minutes: minutes })}
                    description="За сколько до окончания времени решения отправить уведомление"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="AlertTriangle" size={15} className="text-orange-500" />
                  <h3 className="text-sm font-semibold">При отсутствии ответа</h3>
                </div>
                <div className="space-y-2">
                  <InlineTimeInput
                    label="Время без ответа"
                    value={formData.no_response_minutes}
                    onChange={(minutes) => setFormData({ ...formData, no_response_minutes: minutes })}
                    description="Если клиент не отвечает указанное время — заявку можно перевести в другой статус"
                  />
                  <div className="flex items-center justify-between gap-3 py-1">
                    <Label htmlFor="no_response_status" className="text-sm flex-shrink-0">
                      Перевести в статус
                    </Label>
                    <Select
                      value={formData.no_response_status_id?.toString() || 'none'}
                      onValueChange={(value) => setFormData({ ...formData, no_response_status_id: value === 'none' ? undefined : parseInt(value) })}
                    >
                      <SelectTrigger id="no_response_status" className="h-8 text-sm w-48">
                        <SelectValue placeholder="Не переводить" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Не переводить</SelectItem>
                        {statuses.map((status) => (
                          <SelectItem key={status.id} value={status.id.toString()}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="priorities" className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Icon name="Layers" size={16} className="text-purple-500" />
                    Времена по приоритетам
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Индивидуальные сроки для каждого приоритета заявки
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="priority-times-toggle" className="text-xs text-muted-foreground">
                    {priorityTimesEnabled ? 'Вкл' : 'Выкл'}
                  </Label>
                  <Switch
                    id="priority-times-toggle"
                    checked={priorityTimesEnabled}
                    onCheckedChange={onPriorityTimesToggle}
                  />
                </div>
              </div>

              {!priorityTimesEnabled ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="Layers" size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Включите, чтобы задать разные сроки для каждого приоритета</p>
                  <p className="text-xs mt-1">Сейчас используются общие значения со вкладки «Сроки»</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {priorityTimes.map((pt) => {
                    const priority = priorities.find(p => p.id === pt.priority_id);
                    if (!priority) return null;

                    return (
                      <PriorityRow
                        key={pt.priority_id}
                        pt={pt}
                        priority={priority}
                        onUpdate={(updates) => updatePriorityTime(pt.priority_id, updates)}
                        onRemove={() => removePriorityTime(pt.priority_id)}
                      />
                    );
                  })}

                  {availablePriorities.length > 0 && (
                    <Select onValueChange={(val) => addPriorityTime(parseInt(val))}>
                      <SelectTrigger className="w-auto h-8 text-sm">
                        <SelectValue placeholder="Добавить приоритет..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePriorities.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                              {p.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="groups" className="mt-4">
              <SlaGroupBudgets
                slaId={editingSla?.id}
                budgets={groupBudgets}
                onBudgetsChange={setGroupBudgets}
                totalResolutionMinutes={formData.resolution_time_minutes}
                totalResponseMinutes={formData.response_time_minutes}
                priorities={priorities}
                priorityTimes={priorityTimes}
                priorityTimesEnabled={priorityTimesEnabled}
                onValidationChange={onGroupBudgetsValidChange}
              />
            </TabsContent>

            <TabsContent value="settings" className="mt-4 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Icon name="Clock" size={18} className="text-blue-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Учёт рабочего времени</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      SLA-таймеры считаются только в рабочие часы
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.use_work_schedule}
                  onCheckedChange={(checked) => setFormData({ ...formData, use_work_schedule: checked })}
                />
              </div>

              {formData.use_work_schedule && (
                <div className="text-xs text-muted-foreground bg-blue-500/5 p-3 rounded-lg border border-blue-500/10">
                  Нерабочие часы и выходные не будут учитываться при расчёте сроков. Графики берутся из настроек групп исполнителей.
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={!groupBudgetsValid}>
              {editingSla ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const formatTime = (m: number) => {
  if (!m) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min} мин`;
  if (min === 0) return `${h} ч`;
  return `${h} ч ${min} мин`;
};

const PriorityRow = ({
  pt,
  priority,
  onUpdate,
  onRemove,
}: {
  pt: PriorityTime;
  priority: TicketPriority;
  onUpdate: (updates: Partial<PriorityTime>) => void;
  onRemove: () => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
        >
          <Icon
            name={open ? 'ChevronDown' : 'ChevronRight'}
            size={14}
            className="text-muted-foreground flex-shrink-0"
          />
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: priority.color }} />
          <span className="text-sm font-medium truncate">{priority.name}</span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">ур. {priority.level}</span>
        </button>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-shrink-0">
          <span className="flex items-center gap-1">
            <Icon name="Timer" size={11} />
            {formatTime(pt.response_time_minutes)}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="CheckCircle2" size={11} />
            {formatTime(pt.resolution_time_minutes)}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-500 hover:bg-red-500/10 flex-shrink-0"
          onClick={onRemove}
          title="Удалить"
          aria-label="Удалить"
        >
          <Icon name="Trash2" size={14} />
        </Button>
      </div>

      {open && (
        <div className="px-3 pb-2 border-t border-border/50 bg-background/40 divide-y divide-border/40">
          <InlineTimeInput
            label="Реакция"
            value={pt.response_time_minutes}
            onChange={(m) => onUpdate({ response_time_minutes: m })}
            description="Максимальное время для первого ответа на заявку этого приоритета"
          />
          <InlineTimeInput
            label="Уведомление о реакции"
            value={pt.response_notification_minutes}
            onChange={(m) => onUpdate({ response_notification_minutes: m })}
            description="За сколько до окончания времени реакции отправить уведомление"
          />
          <InlineTimeInput
            label="Решение"
            value={pt.resolution_time_minutes}
            onChange={(m) => onUpdate({ resolution_time_minutes: m })}
            description="Максимальное время для полного решения заявки этого приоритета"
          />
          <InlineTimeInput
            label="Уведомление о решении"
            value={pt.resolution_notification_minutes}
            onChange={(m) => onUpdate({ resolution_notification_minutes: m })}
            description="За сколько до окончания времени решения отправить уведомление"
          />
        </div>
      )}
    </div>
  );
};

export default SlaFormDialog;