import { useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { buildDepartmentPath } from '@/utils/departmentPath';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface Department {
  id: number;
  name: string;
  parent_id?: number | null;
}

interface SimpleUser {
  id: number;
  full_name: string;
  username?: string;
}

interface SubordinatesSelectorProps {
  departments: Department[];
  users: SimpleUser[];
  currentUserId?: number;
  selectedDepartmentIds: number[];
  selectedUserIds: number[];
  onChangeDepartments: (ids: number[]) => void;
  onChangeUsers: (ids: number[]) => void;
}

const itemClass =
  'items-start border-0 outline-none ring-0 aria-selected:bg-muted aria-selected:text-foreground data-[selected=true]:bg-muted data-[selected=true]:text-foreground';

const SubordinatesSelector = ({
  departments,
  users,
  currentUserId,
  selectedDepartmentIds,
  selectedUserIds,
  onChangeDepartments,
  onChangeUsers,
}: SubordinatesSelectorProps) => {
  const [depOpen, setDepOpen] = useState(false);
  const [depSearch, setDepSearch] = useState('');
  const [userOpen, setUserOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const SEP = ' → ';

  const depOptions = useMemo(
    () =>
      departments.map((dept) => {
        const path = buildDepartmentPath(departments, dept.id);
        const idx = path.lastIndexOf(SEP);
        const prefix = idx >= 0 ? path.slice(0, idx + SEP.length) : '';
        const last = idx >= 0 ? path.slice(idx + SEP.length) : path;
        return { id: dept.id, name: dept.name, path, prefix, last };
      }),
    [departments],
  );

  const filteredDeps = useMemo(() => {
    const q = depSearch.trim().toLowerCase();
    if (!q) return depOptions;
    return depOptions.filter(
      (o) => o.path.toLowerCase().includes(q) || o.name.toLowerCase().includes(q),
    );
  }, [depOptions, depSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const base = users.filter((u) => u.id !== currentUserId);
    if (!q) return base;
    return base.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q),
    );
  }, [users, userSearch, currentUserId]);

  const toggleDep = (id: number) => {
    if (selectedDepartmentIds.includes(id)) {
      onChangeDepartments(selectedDepartmentIds.filter((x) => x !== id));
    } else {
      onChangeDepartments([...selectedDepartmentIds, id]);
    }
  };

  const toggleUser = (id: number) => {
    if (selectedUserIds.includes(id)) {
      onChangeUsers(selectedUserIds.filter((x) => x !== id));
    } else {
      onChangeUsers([...selectedUserIds, id]);
    }
  };

  const selectedDepList = depOptions.filter((o) => selectedDepartmentIds.includes(o.id));
  const selectedUserList = users.filter((u) => selectedUserIds.includes(u.id));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Отделы</p>
        <Popover open={depOpen} onOpenChange={(o) => { setDepOpen(o); if (!o) setDepSearch(''); }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={depOpen}
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {selectedDepartmentIds.length > 0
                  ? `Выбрано отделов: ${selectedDepartmentIds.length}`
                  : 'Выберите отделы'}
              </span>
              <Icon name="ChevronsUpDown" size={16} className="ml-2 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Поиск отдела..." value={depSearch} onValueChange={setDepSearch} />
              <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
                <CommandEmpty>Отдел не найден</CommandEmpty>
                <CommandGroup>
                  {filteredDeps.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={String(opt.id)}
                      className={itemClass}
                      onSelect={() => toggleDep(opt.id)}
                    >
                      <Icon
                        name="Check"
                        size={16}
                        className={cn('mr-2 mt-0.5 shrink-0', selectedDepartmentIds.includes(opt.id) ? 'opacity-100' : 'opacity-0')}
                      />
                      <span className="whitespace-normal break-words">
                        {opt.prefix}
                        <span className="font-semibold">{opt.last}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedDepList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedDepList.map((d) => (
              <span key={d.id} className="inline-flex items-center gap-1 bg-accent/60 text-xs rounded-full px-2 py-1">
                <span className="max-w-[220px] truncate">{d.path}</span>
                <button type="button" onClick={() => toggleDep(d.id)} className="hover:text-destructive">
                  <Icon name="X" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Конкретные сотрудники</p>
        <Popover open={userOpen} onOpenChange={(o) => { setUserOpen(o); if (!o) setUserSearch(''); }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={userOpen}
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {selectedUserIds.length > 0
                  ? `Выбрано сотрудников: ${selectedUserIds.length}`
                  : 'Выберите сотрудников'}
              </span>
              <Icon name="ChevronsUpDown" size={16} className="ml-2 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Поиск сотрудника..." value={userSearch} onValueChange={setUserSearch} />
              <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
                <CommandEmpty>Сотрудник не найден</CommandEmpty>
                <CommandGroup>
                  {filteredUsers.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={String(u.id)}
                      className={itemClass}
                      onSelect={() => toggleUser(u.id)}
                    >
                      <Icon
                        name="Check"
                        size={16}
                        className={cn('mr-2 mt-0.5 shrink-0', selectedUserIds.includes(u.id) ? 'opacity-100' : 'opacity-0')}
                      />
                      <span className="whitespace-normal break-words">
                        {u.full_name}
                        {u.username ? <span className="text-muted-foreground"> · {u.username}</span> : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedUserList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedUserList.map((u) => (
              <span key={u.id} className="inline-flex items-center gap-1 bg-accent/60 text-xs rounded-full px-2 py-1">
                <span className="max-w-[220px] truncate">{u.full_name}</span>
                <button type="button" onClick={() => toggleUser(u.id)} className="hover:text-destructive">
                  <Icon name="X" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubordinatesSelector;
