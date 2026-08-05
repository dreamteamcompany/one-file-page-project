import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import SlaGroupBudgetsPreview from '@/components/sla/SlaGroupBudgetsPreview';
import { SLAItem, PriorityTime, formatTime } from './types';

const InlineInfo = ({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
    <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
      <Icon name={icon} size={12} className={`${iconColor} shrink-0`} />
      <span className="truncate">{label}</span>
    </div>
    <span className="font-medium text-foreground whitespace-nowrap">{value}</span>
  </div>
);

const PriorityTimesPreview = ({ priorityTimes }: { priorityTimes: PriorityTime[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
          <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={12} />
          <Icon name="Layers" size={12} />
          <span>Приоритеты ({priorityTimes.length})</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 ml-4 space-y-1">
        {priorityTimes.map((pt) => (
          <div
            key={pt.priority_id}
            className="flex items-center gap-2 text-[11px] py-1 px-2 rounded bg-muted/20"
          >
            <div className="flex items-center gap-1 min-w-[70px]">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: pt.priority_color || '#888' }}
              />
              <span className="font-medium truncate">{pt.priority_name}</span>
            </div>
            <span className="text-muted-foreground flex items-center gap-1">
              <Icon name="Timer" size={10} />
              {formatTime(pt.response_time_minutes)}
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
              <Icon name="CheckCircle2" size={10} />
              {formatTime(pt.resolution_time_minutes)}
            </span>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

const SlaCard = ({
  sla,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  getStatusName,
  canEdit,
  canDelete,
}: {
  sla: SLAItem;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getStatusName: (id?: number) => string;
  canEdit: boolean;
  canDelete: boolean;
}) => {
  const hasPriorityTimes = sla.priority_times && sla.priority_times.length > 0;

  return (
    <div className="rounded-lg border border-border bg-muted/20 overflow-hidden hover:border-border/80 transition-colors">
      <div
        className="flex items-center gap-2 p-2.5 cursor-pointer select-none"
        onClick={onToggle}
      >
        <Icon
          name={expanded ? 'ChevronDown' : 'ChevronRight'}
          size={14}
          className="text-muted-foreground shrink-0"
        />
        <span className="text-sm font-medium truncate flex-1 min-w-0">{sla.name}</span>

        <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground flex-shrink-0">
          <span className="flex items-center gap-1">
            <Icon name="Timer" size={11} className="text-primary" />
            {formatTime(sla.response_time_minutes)}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="CheckCircle2" size={11} className="text-green-500" />
            {formatTime(sla.resolution_time_minutes)}
          </span>
        </div>

        <div className="flex gap-1 shrink-0">
          {sla.use_work_schedule && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-500"
              title="Учёт рабочего времени"
            >
              <Icon name="Clock" size={10} />
            </span>
          )}
          {hasPriorityTimes && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-500"
              title="Приоритеты"
            >
              <Icon name="Layers" size={10} />
            </span>
          )}
        </div>

        <div
          className="flex gap-0.5 shrink-0 ml-1"
          onClick={(e) => e.stopPropagation()}
        >
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="h-7 w-7 hover:bg-accent/30"
              title="Редактировать"
              aria-label="Редактировать"
            >
              <Icon name="Pencil" size={13} />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-7 w-7 hover:bg-red-500/10 text-red-500"
              title="Удалить"
              aria-label="Удалить"
            >
              <Icon name="Trash2" size={13} />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-2 pt-1 border-t border-border/50 bg-background/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <div className="divide-y divide-border/40">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-1.5 pb-1">
                Реакция
              </div>
              <InlineInfo
                icon="Timer"
                iconColor="text-primary"
                label="Время реакции"
                value={formatTime(sla.response_time_minutes)}
              />
              <InlineInfo
                icon="Bell"
                iconColor="text-yellow-500"
                label="Уведомление"
                value={`через ${formatTime(sla.response_notification_minutes)}`}
              />
              {sla.no_response_minutes && (
                <InlineInfo
                  icon="AlertTriangle"
                  iconColor="text-orange-500"
                  label="Без ответа"
                  value={`${formatTime(sla.no_response_minutes)} → ${getStatusName(sla.no_response_status_id)}`}
                />
              )}
            </div>
            <div className="divide-y divide-border/40">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-1.5 pb-1">
                Решение
              </div>
              <InlineInfo
                icon="CheckCircle2"
                iconColor="text-green-500"
                label="Время решения"
                value={formatTime(sla.resolution_time_minutes)}
              />
              <InlineInfo
                icon="Bell"
                iconColor="text-yellow-500"
                label="Уведомление"
                value={`через ${formatTime(sla.resolution_notification_minutes)}`}
              />
            </div>
          </div>

          {hasPriorityTimes && (
            <PriorityTimesPreview priorityTimes={sla.priority_times!} />
          )}

          <SlaGroupBudgetsPreview slaId={sla.id} />
        </div>
      )}
    </div>
  );
};

export default SlaCard;