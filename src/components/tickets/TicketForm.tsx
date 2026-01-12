import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface Priority {
  id: number;
  name: string;
  color: string;
}

interface Status {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
}

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  is_required: boolean;
}

interface Service {
  id: number;
  name: string;
  description: string;
  category_id?: number;
  category_name?: string;
}

interface TicketFormProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  formData: {
    title: string;
    description: string;
    category_id: string;
    priority_id: string;
    status_id: string;
    service_id: string;
    due_date: string;
    custom_fields: Record<string, string>;
  };
  setFormData: (data: any) => void;
  categories: Category[];
  priorities: Priority[];
  statuses: Status[];
  departments: Department[];
  customFields: CustomField[];
  services: Service[];
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  onDialogOpen?: () => void;
}

const TicketForm = ({
  dialogOpen,
  setDialogOpen,
  formData,
  setFormData,
  categories,
  priorities,
  statuses,
  departments,
  customFields,
  services,
  handleSubmit,
  onDialogOpen,
}: TicketFormProps) => {
  const [step, setStep] = useState(1);


  
  console.log('[TicketForm] Current step:', step, 'Dialog open:', dialogOpen);

  const handleNext = () => {
    if (!formData.title.trim()) {
      return;
    }
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleServiceSelect = (serviceId: number) => {
    setFormData({ ...formData, service_id: serviceId.toString() });
  };

  const handleDialogChange = (open: boolean) => {
    if (open && onDialogOpen) {
      onDialogOpen();
    }
    setDialogOpen(open);
    if (!open) {
      setTimeout(() => setStep(1), 300);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit(e);
    // Форма закроется в handleSubmit, шаг сбросится в handleDialogChange
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 shadow-lg">
          <Icon name="Plus" size={20} />
          Создать заявку
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="TicketPlus" size={24} />
            Новая заявка
            <Badge variant="secondary" className="ml-auto text-xs">
              Шаг {step} из 2
            </Badge>
            <Badge variant="destructive" className="text-xs">
              step={step}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {step === 1 ? '📝 Заполните основную информацию о заявке' : '🎯 Выберите услугу для вашей заявки'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded text-sm mb-4">
          DEBUG: Текущий шаг = {step}, Показываю {step === 1 ? 'ФОРМУ' : 'УСЛУГИ'}
        </div>

        {step === 1 ? (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Название заявки *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Краткое описание проблемы"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Подробное описание проблемы или запроса"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category_id">Категория</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Icon name={category.icon} size={16} />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority_id">Приоритет</Label>
                <Select
                  value={formData.priority_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите приоритет" />
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
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Желаемый срок</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
              />
            </div>

            {customFields.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-medium text-sm">Дополнительные поля</h3>
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label>
                      {field.name}
                      {field.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      value={formData.custom_fields[field.id] || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          custom_fields: {
                            ...formData.custom_fields,
                            [field.id]: e.target.value,
                          },
                        })
                      }
                      required={field.is_required}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={handleNext}
                className="flex-1 gap-2"
                disabled={!formData.title.trim()}
              >
                Далее
                <Icon name="ArrowRight" size={18} />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
              >
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="space-y-4 mt-4">
              <div className="space-y-3">
                <Label>Выберите услугу</Label>
                {services.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Icon name="Package" size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Нет доступных услуг</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {services.map((service) => (
                      <Card
                        key={service.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          formData.service_id === service.id.toString()
                            ? 'ring-2 ring-primary bg-accent/50'
                            : 'hover:bg-accent/30'
                        }`}
                        onClick={() => handleServiceSelect(service.id)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-start justify-between gap-2">
                            {service.name}
                            {formData.service_id === service.id.toString() && (
                              <Icon name="CheckCircle2" size={20} className="text-primary flex-shrink-0" />
                            )}
                          </CardTitle>
                          {service.category_name && (
                            <Badge variant="secondary" className="w-fit text-xs">
                              {service.category_name}
                            </Badge>
                          )}
                        </CardHeader>
                        {service.description && (
                          <CardContent className="pt-0">
                            <CardDescription className="text-sm line-clamp-2">
                              {service.description}
                            </CardDescription>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="gap-2"
                >
                  <Icon name="ArrowLeft" size={18} />
                  Назад
                </Button>
                <Button
                  type="submit"
                  className="flex-1 gap-2"
                  disabled={!formData.service_id}
                >
                  <Icon name="Send" size={18} />
                  Создать заявку
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TicketForm;