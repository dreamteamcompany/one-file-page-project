import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import type { TicketService, Service } from './ExamplesTab';
import type { PendingReview } from './PendingReviewItem';

interface CorrectForm {
  ticket_service_id: string;
  service_ids: number[];
  questions: string[];
}

interface CorrectReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  correctingReview: PendingReview | null;
  correctForm: CorrectForm;
  setCorrectForm: React.Dispatch<React.SetStateAction<CorrectForm>>;
  ticketServices: TicketService[];
  filteredServices: Service[];
  loading: boolean;
  toggleServiceId: (serviceId: number) => void;
  addQuestion: () => void;
  updateQuestion: (idx: number, value: string) => void;
  removeQuestion: (idx: number) => void;
  handleCorrect: () => void;
}

const CorrectReviewDialog = ({
  open,
  onOpenChange,
  correctingReview,
  correctForm,
  setCorrectForm,
  ticketServices,
  filteredServices,
  loading,
  toggleServiceId,
  addQuestion,
  updateQuestion,
  removeQuestion,
  handleCorrect,
}: CorrectReviewDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Исправить классификацию</DialogTitle>
        <DialogDescription>
          Укажите правильную услугу и сервисы для этой заявки
        </DialogDescription>
      </DialogHeader>
      {correctingReview && (
        <div className="space-y-4">
          <div>
            <Label>Описание заявки</Label>
            <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted/30 rounded">
              {correctingReview.description}
            </p>
          </div>
          <div>
            <Label>Услуга *</Label>
            <Select
              value={correctForm.ticket_service_id}
              onValueChange={v => setCorrectForm(prev => ({ ...prev, ticket_service_id: v, service_ids: [] }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Выберите услугу" />
              </SelectTrigger>
              <SelectContent>
                {ticketServices.map(ts => (
                  <SelectItem key={ts.id} value={ts.id.toString()}>
                    {ts.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredServices.length > 0 && (
            <div>
              <Label>Сервисы</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {filteredServices.map(svc => (
                  <Badge
                    key={svc.id}
                    variant={correctForm.service_ids.includes(svc.id) ? 'default' : 'outline'}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleServiceId(svc.id)}
                  >
                    {svc.name}
                    {correctForm.service_ids.includes(svc.id) && (
                      <Icon name="Check" size={12} className="ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <Label>Уточняющие вопросы</Label>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={addQuestion}>
                <Icon name="Plus" size={12} />
                Добавить
              </Button>
            </div>
            <div className="space-y-2 mt-1.5">
              {correctForm.questions.length === 0 && (
                <p className="text-xs text-muted-foreground">Вопросов нет</p>
              )}
              {correctForm.questions.map((q, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={q}
                    onChange={e => updateQuestion(idx, e.target.value)}
                    placeholder="Текст вопроса"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive flex-shrink-0"
                    onClick={() => removeQuestion(idx)}
                    title="Удалить вопрос"
                    aria-label="Удалить вопрос"
                  >
                    <Icon name="Trash2" size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={handleCorrect} disabled={loading}>
              Сохранить и подтвердить
            </Button>
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>
);

export default CorrectReviewDialog;
