import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_URL, apiFetch, CLASSIFY_TICKET_URL } from '@/utils/api';
import { FN } from '@/config/backend';
import { UploadedAttachment } from '@/hooks/useFileUploader';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  is_required: boolean;
}

const COMMENTS_URL = FN.TICKET_COMMENTS;

export const useTicketForm = (customFields: CustomField[], loadTickets: () => void) => {
  const { token, hasPermission } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
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

  const handleSubmit = async (
    e: React.FormEvent,
    overrideData?: typeof formData,
    attachments?: UploadedAttachment[],
  ): Promise<void> => {
    e.preventDefault();

    if (!hasPermission('tickets', 'create')) {
      toast({
        title: 'Ошибка',
        description: 'У вас нет прав для создания заявок',
        variant: 'destructive',
      });
      return;
    }

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
      const response = await apiFetch(`${API_URL}?endpoint=tickets`, {
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
          ticket_service_id: dataToSubmit.service_id ? parseInt(dataToSubmit.service_id) : null,
          service_ids: dataToSubmit.service_ids || [],
          due_date: dataToSubmit.due_date || null,
          custom_fields: dataToSubmit.custom_fields || {},
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const assigneeName = result.assignee_name || result.assignee_email;
        const autoMsg = result.auto_assigned && assigneeName
          ? ` Исполнитель: ${assigneeName}`
          : '';

        const ticketId = result.id;

        if (ticketId && CLASSIFY_TICKET_URL && dataToSubmit.description) {
          apiFetch(CLASSIFY_TICKET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: dataToSubmit.description,
              source_ticket_id: ticketId,
              queue_only: true,
            }),
          }).catch((e) => console.error('Shadow classify failed:', e));
        }

        const readyAttachments = (attachments || []).filter((a) => a.status === 'done' && a.url);
        if (ticketId && readyAttachments.length > 0 && COMMENTS_URL) {
          try {
            await apiFetch(COMMENTS_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': token,
              },
              body: JSON.stringify({
                ticket_id: ticketId,
                comment: '',
                is_internal: false,
                attachments: readyAttachments.map((a) => ({
                  filename: a.filename,
                  url: a.url,
                  size: a.size,
                })),
              }),
            });
          } catch (attachErr) {
            console.error('Не удалось прикрепить файлы к заявке:', attachErr);
            toast({
              title: 'Предупреждение',
              description: 'Заявка создана, но не удалось прикрепить часть файлов',
              variant: 'destructive',
            });
          }
        }

        toast({
          title: 'Успешно',
          description: `Заявка создана.${autoMsg}`,
        });
        setDialogOpen(false);
        setFormData(initialFormData);
        loadTickets();
        if (ticketId) {
          navigate(`/tickets/${ticketId}`);
        }
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
