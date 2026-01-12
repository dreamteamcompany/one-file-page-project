import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Status {
  id: number;
  name: string;
  color: string;
}

interface Priority {
  id: number;
  name: string;
  color: string;
}

interface BulkActionsBarProps {
  selectedCount: number;
  statuses: Status[];
  priorities: Priority[];
  onChangeStatus: (statusId: number) => Promise<void>;
  onChangePriority: (priorityId: number) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

const BulkActionsBar = ({
  selectedCount,
  statuses,
  priorities,
  onChangeStatus,
  onChangePriority,
  onDelete,
  onCancel,
}: BulkActionsBarProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (value: string) => {
    setLoading(true);
    try {
      await onChangeStatus(parseInt(value));
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (value: string) => {
    setLoading(true);
    try {
      await onChangePriority(parseInt(value));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
      setShowDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
        <div className="bg-card border rounded-lg shadow-2xl p-4 min-w-[600px] max-w-[90vw]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                {selectedCount}
              </Badge>
              <span className="text-sm font-medium">
                {selectedCount === 1 ? 'заявка выбрана' : 
                 selectedCount < 5 ? 'заявки выбраны' : 'заявок выбрано'}
              </span>
            </div>

            <div className="h-6 w-px bg-border" />

            <div className="flex items-center gap-2 flex-1">
              <Select onValueChange={handleStatusChange} disabled={loading}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Изменить статус" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select onValueChange={handlePriorityChange} disabled={loading}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Изменить приоритет" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.id} value={priority.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: priority.color }}
                        />
                        {priority.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={loading}
                className="ml-auto"
              >
                <Icon name="Trash2" size={16} className="mr-2" />
                Удалить
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={loading}
              >
                <Icon name="X" size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заявки?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить {selectedCount}{' '}
              {selectedCount === 1 ? 'заявку' : selectedCount < 5 ? 'заявки' : 'заявок'}?
              Это действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              {loading ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkActionsBar;