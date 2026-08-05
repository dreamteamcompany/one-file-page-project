import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import InlineMinutesInput from './InlineMinutesInput';
import { ExecutorGroup, GroupBudgetItem, formatMinutes } from './types';

interface GroupBudgetRowProps {
  budget: GroupBudgetItem & { _origIndex: number };
  localIdx: number;
  totalCount: number;
  color: string;
  groups: ExecutorGroup[];
  usedGroupIds: number[];
  resolutionOverflow: boolean;
  responseOverflow: boolean;
  updateBudget: (origIndex: number, updates: Partial<GroupBudgetItem>) => void;
  removeBudget: (origIndex: number) => void;
  moveBudget: (origIndex: number, dir: -1 | 1) => void;
}

const GroupBudgetRow = ({
  budget,
  localIdx,
  totalCount,
  color,
  groups,
  usedGroupIds,
  resolutionOverflow,
  responseOverflow,
  updateBudget,
  removeBudget,
  moveBudget,
}: GroupBudgetRowProps) => {
  const [open, setOpen] = useState(false);
  const groupName =
    groups.find((g) => g.id === budget.executor_group_id)?.name ||
    `Группа #${budget.executor_group_id}`;
  const hasOverflow =
    (resolutionOverflow && (budget.resolution_minutes || 0) > 0) ||
    (responseOverflow && (budget.response_minutes || 0) > 0);

  return (
    <div
      className={`rounded-lg border bg-muted/20 overflow-hidden ${
        hasOverflow ? 'border-red-500/40' : 'border-border'
      }`}
    >
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
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium truncate">{groupName}</span>
        </button>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-shrink-0">
          <span className="flex items-center gap-1">
            <Icon name="Timer" size={11} />
            {formatMinutes(budget.response_minutes || 0) || '—'}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="CheckCircle2" size={11} />
            {formatMinutes(budget.resolution_minutes || 0) || '—'}
          </span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={localIdx === 0}
            onClick={() => moveBudget(budget._origIndex, -1)}
            title="Переместить выше"
            aria-label="Переместить выше"
          >
            <Icon name="ChevronUp" size={13} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={localIdx === totalCount - 1}
            onClick={() => moveBudget(budget._origIndex, 1)}
            title="Переместить ниже"
            aria-label="Переместить ниже"
          >
            <Icon name="ChevronDown" size={13} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:bg-red-500/10"
            onClick={() => removeBudget(budget._origIndex)}
            title="Удалить"
            aria-label="Удалить"
          >
            <Icon name="Trash2" size={14} />
          </Button>
        </div>
      </div>

      {open && (
        <div className="px-3 pb-2 border-t border-border/50 bg-background/40 space-y-2">
          <div className="pt-2">
            <Label className="text-xs text-muted-foreground">Группа исполнителей</Label>
            <Select
              value={budget.executor_group_id.toString()}
              onValueChange={(val) =>
                updateBudget(budget._origIndex, {
                  executor_group_id: parseInt(val),
                })
              }
            >
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups
                  .filter(
                    (g) =>
                      g.id === budget.executor_group_id ||
                      !usedGroupIds.includes(g.id)
                  )
                  .map((g) => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="divide-y divide-border/40">
            <InlineMinutesInput
              label="Реакция"
              value={budget.response_minutes}
              onChange={(m) =>
                updateBudget(budget._origIndex, { response_minutes: m })
              }
              invalid={responseOverflow}
              description="Сколько максимум времени группа держит заявку до первого ответа"
            />
            <InlineMinutesInput
              label="Решение"
              value={budget.resolution_minutes}
              onChange={(m) =>
                updateBudget(budget._origIndex, { resolution_minutes: m })
              }
              invalid={resolutionOverflow}
              description="Сколько максимум времени группа держит заявку до полного решения"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupBudgetRow;