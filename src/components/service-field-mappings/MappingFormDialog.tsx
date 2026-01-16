import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';
import { ServiceCategory, Service, FieldGroup, ServiceFieldMapping } from './types';

interface MappingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingMapping: ServiceFieldMapping | null;
  formData: {
    service_category_id: number;
    service_id: number;
    field_group_ids: number[];
  };
  onFormDataChange: (field: string, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  serviceCategories: ServiceCategory[];
  services: Service[];
  fieldGroups: FieldGroup[];
  filteredServices: Service[];
  toggleFieldGroup: (groupId: number) => void;
}

const MappingFormDialog = ({
  open,
  onOpenChange,
  editingMapping,
  formData,
  onFormDataChange,
  onSubmit,
  onReset,
  serviceCategories,
  fieldGroups,
  filteredServices,
  toggleFieldGroup,
}: MappingFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onReset} className="gap-2">
          <Icon name="Plus" size={18} />
          Добавить связь
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingMapping ? 'Редактировать связь' : 'Создать связь'}
          </DialogTitle>
          <DialogDescription>
            Выберите услугу, сервис и группы полей для этой комбинации
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Услуга *</Label>
            <Select
              value={formData.service_category_id > 0 ? formData.service_category_id.toString() : ''}
              onValueChange={(value) =>
                onFormDataChange('service_category_id', {
                  service_category_id: parseInt(value),
                  service_id: 0,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите услугу" />
              </SelectTrigger>
              <SelectContent>
                {serviceCategories.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    Нет доступных услуг
                  </div>
                ) : (
                  serviceCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Сервис *</Label>
            <Select
              value={formData.service_id > 0 ? formData.service_id.toString() : ''}
              onValueChange={(value) =>
                onFormDataChange('service_id', parseInt(value))
              }
              disabled={!formData.service_category_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите сервис" />
              </SelectTrigger>
              <SelectContent>
                {filteredServices.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    Нет сервисов для выбранной услуги
                  </div>
                ) : (
                  filteredServices.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {!formData.service_category_id && (
              <p className="text-xs text-muted-foreground">
                Сначала выберите услугу
              </p>
            )}
            {formData.service_category_id > 0 && filteredServices.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Для этой услуги нет доступных сервисов
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Группы полей</Label>
            <ScrollArea className="h-64 border rounded-md p-3">
              {fieldGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет доступных групп полей.
                  <br />
                  Создайте их на странице "Дополнительные поля".
                </p>
              ) : (
                <div className="space-y-2">
                  {fieldGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-start space-x-2 p-2 hover:bg-accent rounded-md"
                    >
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={formData.field_group_ids.includes(group.id)}
                        onCheckedChange={() => toggleFieldGroup(group.id)}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`group-${group.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {group.name}
                        </label>
                        {group.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Полей: {group.field_ids.length}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              Выбрано групп: {formData.field_group_ids.length}
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit">
              {editingMapping ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MappingFormDialog;
