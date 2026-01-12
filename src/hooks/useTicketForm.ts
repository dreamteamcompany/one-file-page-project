import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  is_required: boolean;
}

export const useTicketForm = (customFields: CustomField[], loadTickets: () => void) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const initialFormData = {
    title: '',
    description: '',
    category_id: '',
    priority_id: '',
    status_id: '1',
    service_id: '',
    due_date: '',
    custom_fields: {} as Record<string, string>,
  };

  const [formData, setFormData] = useState(initialFormData);

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!token) {
      toast({
        title: 'Ошибка',
        description: 'Необходима авторизация',
        variant: 'destructive',
      });
      return;
    }

    try {
      const mainUrl = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';
      const response = await fetch(`${mainUrl}?endpoint=tickets-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category_id: formData.category_id ? parseInt(formData.category_id) : null,
          priority_id: formData.priority_id ? parseInt(formData.priority_id) : null,
          status_id: 1,
          service_id: formData.service_id ? parseInt(formData.service_id) : null,
          due_date: formData.due_date || null,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Заявка создана',
        });
        setDialogOpen(false);
        setFormData(initialFormData);
        loadTickets();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось создать заявку',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
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
    resetForm,
  };
};