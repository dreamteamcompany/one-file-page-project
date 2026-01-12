import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface CustomFieldDefinition {
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

const initialFormData: PlannedPaymentFormData = {
  category_id: '',
  amount: '',
  description: '',
  planned_date: '',
  legal_entity_id: '',
  contractor_id: '',
  department_id: '',
  service_id: '',
  invoice_number: '',
  invoice_date: '',
  recurrence_type: 'once',
  recurrence_end_date: '',
  custom_fields: {},
};

export const usePlannedPaymentForm = (
  customFields: CustomFieldDefinition[],
  onSuccess: () => void
) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PlannedPaymentFormData>(initialFormData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requiredFields = customFields.filter((field) => field.is_required);
    const missingFields = requiredFields.filter(
      (field) => !formData.custom_fields[field.id]
    );

    if (missingFields.length > 0) {
      toast({
        title: 'Ошибка',
        description: `Заполните обязательные поля: ${missingFields.map((f) => f.name).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/a0000b1e-3d3e-4094-b08e-2893df500d3f', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token || '',
        },
        body: JSON.stringify({
          category_id: parseInt(formData.category_id),
          amount: parseFloat(formData.amount),
          description: formData.description,
          planned_date: formData.planned_date,
          legal_entity_id: formData.legal_entity_id ? parseInt(formData.legal_entity_id) : null,
          contractor_id: formData.contractor_id ? parseInt(formData.contractor_id) : null,
          department_id: formData.department_id ? parseInt(formData.department_id) : null,
          service_id: formData.service_id ? parseInt(formData.service_id) : null,
          invoice_number: formData.invoice_number,
          invoice_date: formData.invoice_date || null,
          recurrence_type: formData.recurrence_type,
          recurrence_end_date: formData.recurrence_end_date || null,
          custom_fields: formData.custom_fields,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Запланированный платёж создан',
        });
        setDialogOpen(false);
        setFormData(initialFormData);
        onSuccess();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось создать платёж',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to create planned payment:', err);
      toast({
        title: 'Ошибка сети',
        description: 'Проверьте подключение к интернету',
        variant: 'destructive',
      });
    }
  };

  return {
    dialogOpen,
    setDialogOpen,
    formData,
    setFormData,
    handleSubmit,
  };
};
