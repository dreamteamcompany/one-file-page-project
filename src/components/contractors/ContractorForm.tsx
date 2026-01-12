import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Contractor {
  id: number;
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legal_address: string;
  actual_address: string;
  phone: string;
  email: string;
  contact_person: string;
  bank_name: string;
  bank_bik: string;
  bank_account: string;
  correspondent_account: string;
  notes: string;
  is_active: boolean;
  created_at: string;
}

interface ContractorFormProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  editingContractor: Contractor | null;
  formData: {
    name: string;
    inn: string;
    kpp: string;
    ogrn: string;
    legal_address: string;
    actual_address: string;
    phone: string;
    email: string;
    contact_person: string;
    bank_name: string;
    bank_bik: string;
    bank_account: string;
    correspondent_account: string;
    notes: string;
  };
  setFormData: (data: any) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleDialogClose: (open: boolean) => void;
}

const ContractorForm = ({
  dialogOpen,
  setDialogOpen,
  editingContractor,
  formData,
  setFormData,
  handleSubmit,
  handleDialogClose,
}: ContractorFormProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Контрагенты</h1>
        <p className="text-sm md:text-base text-muted-foreground">Управление контрагентами</p>
      </div>
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogTrigger asChild>
          <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
            <Icon name="Plus" size={18} />
            <span>Добавить контрагента</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContractor ? 'Редактировать контрагента' : 'Новый контрагент'}</DialogTitle>
            <DialogDescription>
              {editingContractor ? 'Обновите информацию о контрагенте' : 'Добавьте нового контрагента'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ООО 'Компания'"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inn">ИНН</Label>
                <Input
                  id="inn"
                  value={formData.inn}
                  onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                  placeholder="1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpp">КПП</Label>
                <Input
                  id="kpp"
                  value={formData.kpp}
                  onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
                  placeholder="123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ogrn">ОГРН</Label>
                <Input
                  id="ogrn"
                  value={formData.ogrn}
                  onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })}
                  placeholder="1234567890123"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="legal_address">Юридический адрес</Label>
              <Textarea
                id="legal_address"
                value={formData.legal_address}
                onChange={(e) => setFormData({ ...formData, legal_address: e.target.value })}
                placeholder="г. Москва, ул. Примерная, д. 1"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actual_address">Фактический адрес</Label>
              <Textarea
                id="actual_address"
                value={formData.actual_address}
                onChange={(e) => setFormData({ ...formData, actual_address: e.target.value })}
                placeholder="г. Москва, ул. Примерная, д. 1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="info@company.ru"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">Контактное лицо</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Иванов Иван Иванович"
              />
            </div>

            <div className="border-t border-white/10 pt-4">
              <h4 className="text-sm font-semibold mb-3">Банковские реквизиты</h4>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Название банка</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="ПАО Сбербанк"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_bik">БИК</Label>
                    <Input
                      id="bank_bik"
                      value={formData.bank_bik}
                      onChange={(e) => setFormData({ ...formData, bank_bik: e.target.value })}
                      placeholder="044525225"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account">Расчетный счет</Label>
                    <Input
                      id="bank_account"
                      value={formData.bank_account}
                      onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                      placeholder="40702810000000000000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="correspondent_account">Корреспондентский счет</Label>
                  <Input
                    id="correspondent_account"
                    value={formData.correspondent_account}
                    onChange={(e) => setFormData({ ...formData, correspondent_account: e.target.value })}
                    placeholder="30101810000000000000"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Примечания</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Дополнительная информация"
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full">
              {editingContractor ? 'Сохранить' : 'Добавить'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractorForm;
