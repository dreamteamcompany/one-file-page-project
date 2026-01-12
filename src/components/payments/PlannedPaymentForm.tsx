import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
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

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface LegalEntity {
  id: number;
  name: string;
}

interface Contractor {
  id: number;
  name: string;
}

interface CustomerDepartment {
  id: number;
  name: string;
}

interface Service {
  id: number;
  name: string;
  description: string;
}

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  is_required: boolean;
}

interface PlannedPaymentFormData {
  category_id: string;
  amount: string;
  description: string;
  planned_date: string;
  legal_entity_id: string;
  contractor_id: string;
  department_id: string;
  service_id: string;
  invoice_number: string;
  invoice_date: string;
  recurrence_type: string;
  recurrence_end_date: string;
  custom_fields: Record<string, string>;
}

interface PlannedPaymentFormProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  formData: PlannedPaymentFormData;
  setFormData: (data: PlannedPaymentFormData) => void;
  categories: Category[];
  legalEntities: LegalEntity[];
  contractors: Contractor[];
  customerDepartments: CustomerDepartment[];
  customFields: CustomField[];
  services: Service[];
  handleSubmit: (e: React.FormEvent) => void;
  onDialogOpen?: () => void;
}

const PlannedPaymentForm = ({
  dialogOpen,
  setDialogOpen,
  formData,
  setFormData,
  categories,
  legalEntities,
  contractors,
  customerDepartments,
  customFields,
  services,
  handleSubmit,
  onDialogOpen,
}: PlannedPaymentFormProps) => {
  const handleOpenChange = (open: boolean) => {
    if (open && onDialogOpen) {
      onDialogOpen();
    }
    setDialogOpen(open);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 shadow-lg">
          <Icon name="Plus" size={20} />
          Запланировать платёж
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="CalendarClock" size={24} />
            Новый запланированный платёж
          </DialogTitle>
          <DialogDescription>
            Создайте запланированный платёж с возможностью автоматического повторения
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_id">Категория *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, category_id: value })
                }
                required
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
              <Label htmlFor="amount">Сумма (₽) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Назначение платежа *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Например: Аренда офиса"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="planned_date">Дата платежа *</Label>
              <Input
                id="planned_date"
                type="date"
                value={formData.planned_date}
                onChange={(e) =>
                  setFormData({ ...formData, planned_date: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legal_entity_id">Юридическое лицо</Label>
              <Select
                value={formData.legal_entity_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, legal_entity_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите юр. лицо" />
                </SelectTrigger>
                <SelectContent>
                  {legalEntities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id.toString()}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="Repeat" size={18} className="text-blue-400" />
              <Label className="text-blue-200">Настройки повторения</Label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recurrence_type">Тип повторения</Label>
                <Select
                  value={formData.recurrence_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, recurrence_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Однократно</SelectItem>
                    <SelectItem value="daily">Ежедневно</SelectItem>
                    <SelectItem value="weekly">Еженедельно</SelectItem>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                    <SelectItem value="yearly">Ежегодно</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.recurrence_type !== 'once' && (
                <div className="space-y-2">
                  <Label htmlFor="recurrence_end_date">Дата окончания повторений</Label>
                  <Input
                    id="recurrence_end_date"
                    type="date"
                    value={formData.recurrence_end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, recurrence_end_date: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractor_id">Контрагент</Label>
              <Select
                value={formData.contractor_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, contractor_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите контрагента" />
                </SelectTrigger>
                <SelectContent>
                  {contractors.map((contractor) => (
                    <SelectItem key={contractor.id} value={contractor.id.toString()}>
                      {contractor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department_id">Отдел-заказчик</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, department_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите отдел" />
                </SelectTrigger>
                <SelectContent>
                  {customerDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_id">Сервис</Label>
              <Select
                value={formData.service_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, service_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сервис" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_number">Номер счёта</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) =>
                  setFormData({ ...formData, invoice_number: e.target.value })
                }
                placeholder="INV-001"
              />
            </div>
          </div>

          {customFields.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
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
            <Button type="submit" className="flex-1 gap-2">
              <Icon name="CalendarCheck" size={18} />
              Запланировать
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Отмена
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PlannedPaymentForm;