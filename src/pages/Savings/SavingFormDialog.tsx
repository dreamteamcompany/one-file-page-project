import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Service, Employee, SavingReason, SavingFormData, CustomerDepartment } from './types';

interface SavingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: SavingFormData;
  setFormData: (data: SavingFormData) => void;
  services: Service[];
  employees: Employee[];
  savingReasons: SavingReason[];
  departments: CustomerDepartment[];
  onSubmit: (e: React.FormEvent) => void;
}

const SavingFormDialog = ({
  open,
  onOpenChange,
  formData,
  setFormData,
  services,
  employees,
  savingReasons,
  departments,
  onSubmit,
}: SavingFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Icon name="Plus" size={20} />
          Добавить экономию
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить экономию</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service_id">Сервис *</Label>
            <Select 
              value={formData.service_id} 
              onValueChange={(value) => setFormData({ ...formData, service_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={services.length === 0 ? "Загрузка..." : "Выберите сервис"} />
              </SelectTrigger>
              <SelectContent>
                {services.length === 0 ? (
                  <SelectItem value="none" disabled>Загрузка сервисов...</SelectItem>
                ) : (
                  services.map(service => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание экономии *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Опишите, как была достигнута экономия"
              required
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Сумма экономии *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="10000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Валюта *</Label>
              <Select 
                value={formData.currency} 
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RUB">RUB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="saving_reason_id">Экономия достигнута за счет:</Label>
            <Select 
              value={formData.saving_reason_id} 
              onValueChange={(value) => setFormData({ ...formData, saving_reason_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={savingReasons.length === 0 ? "Загрузка..." : "Выберите причину"} />
              </SelectTrigger>
              <SelectContent>
                {savingReasons.length === 0 ? (
                  <SelectItem value="none" disabled>Загрузка причин...</SelectItem>
                ) : (
                  savingReasons.map(reason => (
                    <SelectItem key={reason.id} value={reason.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span>{reason.icon}</span>
                        <span>{reason.name}</span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Эквивалент *</Label>
            <Select 
              value={formData.frequency} 
              onValueChange={(value) => setFormData({ ...formData, frequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Единоразово</SelectItem>
                <SelectItem value="monthly">Ежемесячно</SelectItem>
                <SelectItem value="quarterly">Ежеквартально</SelectItem>
                <SelectItem value="yearly">Ежегодно</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_department_id">Отдел, благодаря которому сэкономлено *</Label>
            <Select 
              value={formData.customer_department_id} 
              onValueChange={(value) => setFormData({ ...formData, customer_department_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={departments.length === 0 ? "Загрузка..." : "Выберите отдел"} />
              </SelectTrigger>
              <SelectContent>
                {departments.length === 0 ? (
                  <SelectItem value="none" disabled>Загрузка отделов...</SelectItem>
                ) : (
                  departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee_id">Автор экономии *</Label>
            <Select 
              value={formData.employee_id} 
              onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={employees.length === 0 ? "Загрузка..." : "Выберите сотрудника"} />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  <SelectItem value="none" disabled>Загрузка сотрудников...</SelectItem>
                ) : (
                  employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>
                      {employee.full_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">Добавить</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SavingFormDialog;