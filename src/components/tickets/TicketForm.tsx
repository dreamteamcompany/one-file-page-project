import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import TicketFormStep1 from './TicketFormStep1';
import TicketFormStep2 from './TicketFormStep2';
import TicketFormStep3 from './TicketFormStep3';

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
  service_ids?: number[];
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
    service_ids: number[];
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
  ticketServices?: Service[];
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
  ticketServices = [],
  handleSubmit,
  onDialogOpen,
}: TicketFormProps) => {
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);


  
  console.log('[TicketForm] Current step:', step, 'Dialog open:', dialogOpen);

  const handleNext = () => {
    if (!formData.service_id) {
      return;
    }
    setStep(2);
  };

  const handleNextToServices = () => {
    setStep(3);
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
    } else {
      setStep(1);
    }
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
      setTimeout(() => {
        setStep(1);
        setSelectedServices([]);
      }, 300);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedFormData = { ...formData, service_ids: selectedServices };
    setFormData(updatedFormData);
    
    await new Promise(resolve => setTimeout(resolve, 10));
    await handleSubmit(e);
  };

  const toggleService = (serviceId: number) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Находим выбранную услугу заявки
  const selectedTicketService = ticketServices.find(
    ts => ts.id.toString() === formData.service_id
  );
  
  // Фильтруем сервисы по service_ids из выбранной услуги
  const filteredServices = selectedTicketService?.service_ids
    ? services.filter(service => selectedTicketService.service_ids?.includes(service.id))
    : [];
  
  const availableTicketServices = ticketServices.length > 0 ? ticketServices : services;

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
              Шаг {step} из 3
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {step === 1 && '🎯 Выберите услугу для вашей заявки'}
            {step === 2 && '🔧 Выберите сервисы для услуги'}
            {step === 3 && '📝 Заполните основную информацию о заявке'}
          </DialogDescription>
        </DialogHeader>



        {step === 1 ? (
          <TicketFormStep2
            formData={formData}
            availableTicketServices={availableTicketServices}
            onServiceSelect={handleServiceSelect}
            onNext={handleNext}
            onBack={() => handleDialogChange(false)}
          />
        ) : step === 2 ? (
          <TicketFormStep3
            filteredServices={filteredServices}
            selectedServices={selectedServices}
            onToggleService={toggleService}
            onNext={handleNextToServices}
            onBack={handleBack}
          />
        ) : (
          <TicketFormStep1
            formData={formData}
            setFormData={setFormData}
            categories={categories}
            priorities={priorities}
            customFields={customFields}
            onSubmit={onSubmit}
            onBack={handleBack}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TicketForm;