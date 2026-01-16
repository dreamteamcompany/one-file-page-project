import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_URL } from '@/utils/api';

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
    service_ids: [] as number[],
    due_date: '',
    custom_fields: {} as Record<string, string>,
  };

  const [formData, setFormData] = useState(initialFormData);

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent, overrideData?: typeof formData): Promise<void> => {
    e.preventDefault();

    if (!token) {
      toast({
        title: 'Ошибка',
        description: 'Необходима авторизация',
        variant: 'destructive',
      });
      return;
    }

    const dataToSubmit = overrideData || formData;

    try {
      const response = await fetch(`${API_URL}?endpoint=tickets-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          title: dataToSubmit.title,
          description: dataToSubmit.description,
          category_id: dataToSubmit.category_id ? parseInt(dataToSubmit.category_id) : null,
          priority_id: dataToSubmit.priority_id ? parseInt(dataToSubmit.priority_id) : null,
          status_id: 1,
          service_id: dataToSubmit.service_id ? parseInt(dataToSubmit.service_id) : null,
          service_ids: dataToSubmit.service_ids || [],
          due_date: dataToSubmit.due_date || null,
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