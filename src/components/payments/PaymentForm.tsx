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
  inn: string;
  kpp: string;
  address: string;
}

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  options: string;
}

interface Contractor {
  id: number;
  name: string;
  inn: string;
}

interface CustomerDepartment {
  id: number;
  name: string;
  description: string;
}

interface Service {
  id: number;
  name: string;
  description: string;
  intermediate_approver_id: number;
  final_approver_id: number;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
}

interface PaymentFormProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  formData: Record<string, string | undefined>;
  setFormData: (data: Record<string, string | undefined>) => void;
  categories: Category[];
  legalEntities: LegalEntity[];
  contractors: Contractor[];
  customerDepartments: CustomerDepartment[];
  customFields: CustomField[];
  services: Service[];
  handleSubmit: (e: React.FormEvent) => void;
}

const PaymentForm = ({
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
}: PaymentFormProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">История платежей</h1>
        <p className="text-sm md:text-base text-muted-foreground">Все операции по IT расходам</p>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
            <Icon name="Plus" size={18} />
            <span>Добавить платёж</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый платёж</DialogTitle>
            <DialogDescription>
              Добавьте информацию о новой операции
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Категория</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  disabled={true}
                >
                  <SelectTrigger className="bg-muted/50 cursor-not-allowed">
                    <SelectValue placeholder="Выбирается автоматически из сервиса" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Icon name={cat.icon} size={16} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_entity">Юридическое лицо</Label>
                <Select
                  value={formData.legal_entity_id}
                  onValueChange={(value) => setFormData({ ...formData, legal_entity_id: value })}
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
              <div className="space-y-2">
                <Label htmlFor="contractor">Контрагент</Label>
                <Select
                  value={formData.contractor_id}
                  onValueChange={(value) => setFormData({ ...formData, contractor_id: value })}
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
                <Label htmlFor="department">Отдел-заказчик</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите отдел" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerDepartments.map((department) => (
                      <SelectItem key={department.id} value={department.id.toString()}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service">Сервис</Label>
                <Select
                  value={formData.service_id}
                  onValueChange={(value) => {
                    const selectedService = services.find(s => s.id.toString() === value);
                    setFormData({ 
                      ...formData, 
                      service_id: value,
                      service_description: selectedService?.description || '',
                      category_id: selectedService?.category_id ? selectedService.category_id.toString() : formData.category_id
                    });
                  }}
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
              {formData.service_id && (
                <div className="space-y-2">
                  <Label htmlFor="service_description">Описание сервиса</Label>
                  <Input
                    id="service_description"
                    value={formData.service_description || ''}
                    readOnly
                    disabled
                    className="bg-muted/50 cursor-not-allowed"
                    placeholder="Описание сервиса"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="amount">Сумма</Label>
                <Input
                  id="amount"
                  type="text"
                  value={formData.amount ? formData.amount.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\s/g, '');
                    if (/^\d*$/.test(value)) {
                      setFormData({ ...formData, amount: value });
                    }
                  }}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Номер счёта</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number || ''}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="Введите номер счёта"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Дата счёта</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date || ''}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  min="2000-01-01"
                  max="2099-12-31"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Назначение</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Описание платежа"
                required
              />
            </div>
            
            {customFields.length > 0 && (
              <div className="border-t border-white/10 pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Дополнительные поля</h4>
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`custom_field_${field.id}`}>{field.name}</Label>
                    {field.field_type === 'text' && (
                      <Input
                        id={`custom_field_${field.id}`}
                        value={formData[`custom_field_${field.id}`] || ''}
                        onChange={(e) => setFormData({ ...formData, [`custom_field_${field.id}`]: e.target.value })}
                        placeholder={`Введите ${field.name.toLowerCase()}`}
                      />
                    )}
                    {field.field_type === 'select' && (
                      <Select
                        value={formData[`custom_field_${field.id}`]}
                        onValueChange={(value) => setFormData({ ...formData, [`custom_field_${field.id}`]: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите значение" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.split(',').map((option, idx) => (
                            <SelectItem key={idx} value={option.trim()}>
                              {option.trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.field_type === 'toggle' && (
                      <Select
                        value={formData[`custom_field_${field.id}`]}
                        onValueChange={(value) => setFormData({ ...formData, [`custom_field_${field.id}`]: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите значение" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.split(',').map((option, idx) => (
                            <SelectItem key={idx} value={option.trim()}>
                              {option.trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.field_type === 'file' && (
                      <div>
                        <Input
                          id={`custom_field_${field.id}`}
                          type="file"
                          accept={field.options ? field.options.split(',').map(ext => `.${ext.trim()}`).join(',') : '*'}
                          className="cursor-pointer file:mr-4 file:py-2.5 file:px-5 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer file:shadow-sm"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            const allowedExtensions = field.options?.split(',').map(ext => ext.trim().toLowerCase()) || [];
                            const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
                            
                            if (allowedExtensions.length > 0 && !allowedExtensions.includes(fileExtension)) {
                              alert(`Недопустимый формат файла. Разрешены: ${field.options}`);
                              e.target.value = '';
                              return;
                            }
                            
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const base64 = (reader.result as string).split(',')[1];
                              
                              try {
                                const response = await fetch('https://functions.poehali.dev/465f29bc-7031-4a0b-a671-05368d234efe', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    file: base64,
                                    fileName: file.name,
                                    contentType: file.type
                                  })
                                });
                                
                                const data = await response.json();
                                if (data.url) {
                                  setFormData({ ...formData, [`custom_field_${field.id}`]: data.url });
                                }
                              } catch (err) {
                                console.error('Upload failed:', err);
                                alert('Ошибка загрузки файла');
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        {formData[`custom_field_${field.id}`] && (
                          <p className="text-xs text-green-500 mt-1">✓ Файл загружен</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <Button type="submit" className="w-full">
              Добавить
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentForm;