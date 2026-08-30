import { useState, useEffect, useCallback, useMemo } from 'react';
import { FIELD_GROUPS_URL, SERVICE_FIELD_MAPPINGS_URL, CLASSIFY_TICKET_URL, apiFetch, getApiUrl } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useFileUploader } from '@/hooks/useFileUploader';
import { FN } from '@/config/backend';
import {
  Service,
  CustomField,
  ClassificationResult,
  FormData,
} from './TicketFormTypes';

interface UseTicketFormLogicParams {
  formData: FormData;
  setFormData: (data: Record<string, string | number | number[] | Record<string, string>>) => void;
  services: Service[];
  ticketServices: Service[];
  handleSubmit: (
    e: React.FormEvent,
    overrideData?: Record<string, string | number | number[] | Record<string, string>>,
    attachments?: import('@/hooks/useFileUploader').UploadedAttachment[],
  ) => Promise<void>;
  onDialogOpen?: () => void;
  setDialogOpen: (open: boolean) => void;
}

export const useTicketFormLogic = ({
  formData,
  setFormData,
  services,
  ticketServices,
  handleSubmit,
  onDialogOpen,
  setDialogOpen,
}: UseTicketFormLogicParams) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [clarifyingAnswers, setClarifyingAnswers] = useState<Record<number, string>>({});
  const [visibleCustomFields, setVisibleCustomFields] = useState<CustomField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [classificationMode, setClassificationMode] = useState<'ai' | 'manual'>('ai');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileUploader = useFileUploader('uploads/attachments');

  const userFilteredTicketServices = useMemo(() => {
    if (!user) return ticketServices;
    return ticketServices.filter(ts => {
      if (!ts.visible_to_user_ids || ts.visible_to_user_ids.length === 0) return true;
      return ts.visible_to_user_ids.includes(user.id);
    });
  }, [ticketServices, user]);

  const userFilteredServices = useMemo(() => {
    if (!user) return services;
    return services.filter(s => {
      if (!s.visible_to_user_ids || s.visible_to_user_ids.length === 0) return true;
      return s.visible_to_user_ids.includes(user.id);
    });
  }, [services, user]);

  useEffect(() => {
    const loadMode = async () => {
      try {
        const url = `${getApiUrl('system_settings')}?resource=system_settings&key=classification_mode`;
        const res = await apiFetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.value === 'manual' || data.value === 'ai') {
            setClassificationMode(data.value);
          }
        }
      } catch (e) { console.error(e); }
    };
    loadMode();
  }, []);

  const handleDialogChange = (open: boolean) => {
    if (open) {
      setStep(1);
      setSelectedServices([]);
      setClassification(null);
      setClarifyingAnswers({});
      setVisibleCustomFields([]);
      fileUploader.clear();
      if (onDialogOpen) {
        onDialogOpen();
      }
    }
    setDialogOpen(open);
  };

  const selectedTicketService = ticketServices.find(
    ts => ts.id.toString() === formData.service_id
  );

  const filteredServices = selectedTicketService?.service_ids
    ? userFilteredServices.filter(service => selectedTicketService.service_ids?.includes(service.id))
    : [];

  const hasServiceItems = filteredServices.length > 0;

  const AI_TRAINING_URL = FN.AI_TRAINING;

  const logClassifyError = async (description: string, errorMsg: string, durationMs: number) => {
    try {
      await apiFetch(`${AI_TRAINING_URL}?endpoint=logs`, {
        method: 'POST',
        body: JSON.stringify({ description, error_message: errorMsg, duration_ms: durationMs }),
      });
    } catch { /* ignore */ }
  };

  const classifyTicket = async () => {
    if (!formData.description.trim()) return;

    setClassifying(true);
    const startTime = Date.now();
    try {
      const resp = await apiFetch(CLASSIFY_TICKET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: formData.description }),
      });

      if (resp.ok) {
        const result: ClassificationResult = await resp.json();
        setClarifyingAnswers({});
        if (result.ticket_service_id && result.confidence > 0) {
          setClassification(result);
          setFormData({
            ...formData,
            service_id: result.ticket_service_id.toString(),
          });
          setSelectedServices(result.service_ids || []);
        } else {
          setClassification(null);
        }
        setStep(2);
      } else {
        const duration = Date.now() - startTime;
        logClassifyError(formData.description, `HTTP ${resp.status}`, duration);
        setStep(2);
        setClassification(null);
      }
    } catch (err) {
      const duration = Date.now() - startTime;
      const errMsg = err instanceof Error ? err.message : 'Network error';
      console.error('[TicketForm] Classification failed:', err);
      logClassifyError(formData.description, errMsg, duration);
      setStep(2);
      setClassification(null);
    } finally {
      setClassifying(false);
    }
  };

  const handleNextFromDescription = () => {
    if (classificationMode === 'manual') {
      setClassification({ ticket_service_id: 0, service_ids: [], ticket_service_name: '', service_names: [], confidence: 0 });
      setStep(2);
    } else {
      classifyTicket();
    }
  };

  const handleChangeTicketService = (serviceId: number) => {
    setFormData({ ...formData, service_id: serviceId.toString() });
    setSelectedServices([]);
  };

  const toggleService = (serviceId: number) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const getCustomFieldsStep = () => {
    if (classificationMode === 'manual') {
      return 3;
    }
    return 3;
  };

  const MANUAL_DESCRIPTION_STEP = 4;

  const handleNextFromClassify = async () => {
    const fields = await loadVisibleFields();
    if (fields.length > 0) {
      setStep(getCustomFieldsStep());
    } else {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      onSubmit(fakeEvent);
    }
  };

  const goToCustomFieldsOrDescription = async () => {
    // Дожидаемся загрузки доп.полей выбранной услуги, прежде чем решать,
    // показывать ли шаг доп.полей. Иначе (race condition) переход мог
    // произойти раньше загрузки — и шаг с полями ошибочно проматывался.
    const fields = await loadVisibleFields();
    if (fields.length > 0) {
      setStep(3);
    } else {
      setStep(MANUAL_DESCRIPTION_STEP);
    }
  };

  const handleNextFromManualService = async () => {
    if (!hasServiceItems) {
      await goToCustomFieldsOrDescription();
    } else {
      setStep(2);
    }
  };

  const handleNextFromManualServiceItems = async () => {
    await goToCustomFieldsOrDescription();
  };

  const handleNextFromManualCustomFields = () => {
    setStep(MANUAL_DESCRIPTION_STEP);
  };

  const handleBack = () => {
    if (classificationMode === 'manual') {
      if (step === MANUAL_DESCRIPTION_STEP) {
        if (visibleCustomFields.length > 0) {
          setStep(3);
        } else {
          setStep(hasServiceItems ? 2 : 1);
        }
      } else if (step === 3) {
        setStep(hasServiceItems ? 2 : 1);
      } else if (step === 2) {
        setStep(1);
      }
    } else {
      if (step === 3) {
        setStep(2);
      } else if (step === 2) {
        setStep(1);
      }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const finalTitle = (formData.title || '').trim()
        || selectedTicketService?.ticket_title
        || formData.description.slice(0, 100)
        || 'Новая заявка';

      const questions = classification?.clarifying_questions || [];
      let finalDescription = formData.description;
      const qaLines = questions
        .map((q, idx) => {
          const answer = (clarifyingAnswers[idx] || '').trim();
          return answer ? `${q}\n— ${answer}` : '';
        })
        .filter(Boolean);
      if (qaLines.length > 0) {
        finalDescription = `${finalDescription}\n\nУточнения:\n${qaLines.join('\n\n')}`;
      }

      const updatedFormData = {
        ...formData,
        description: finalDescription,
        service_ids: selectedServices,
        title: finalTitle,
        category_id: '',
      };
      setFormData(updatedFormData);
      await handleSubmit(e, updatedFormData, fileUploader.successful);
      setStep(1);
      setSelectedServices([]);
      setClassification(null);
      setClarifyingAnswers({});
      fileUploader.clear();
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadVisibleFields = useCallback(async (): Promise<CustomField[]> => {
    if (!formData.service_id || selectedServices.length === 0) {
      setVisibleCustomFields([]);
      return [];
    }

    setLoadingFields(true);
    try {
      const [mappingsResponse, groupsResponse] = await Promise.all([
        apiFetch(SERVICE_FIELD_MAPPINGS_URL),
        apiFetch(FIELD_GROUPS_URL),
      ]);

      if (!mappingsResponse.ok || !groupsResponse.ok) {
        setVisibleCustomFields([]);
        return [];
      }

      const [mappings, fieldGroups] = await Promise.all([
        mappingsResponse.json(),
        groupsResponse.json(),
      ]);

      const relevantGroupIds = new Set<number>();
      const ticketServiceId = parseInt(formData.service_id);

      selectedServices.forEach(serviceId => {
        mappings
          .filter(
            (m: { ticket_service_id: number; service_id: number }) =>
              m.ticket_service_id === ticketServiceId && m.service_id === serviceId
          )
          .forEach((m: { field_group_id: number }) => relevantGroupIds.add(m.field_group_id));
      });

      if (relevantGroupIds.size === 0) {
        setVisibleCustomFields([]);
        return [];
      }

      const allFields: CustomField[] = [];
      fieldGroups.forEach((group: { id: number; fields: CustomField[] }) => {
        if (relevantGroupIds.has(group.id) && group.fields) {
          group.fields.forEach((field: CustomField) => {
            if (!allFields.find(f => f.id === field.id)) {
              allFields.push(field);
            }
          });
        }
      });

      setVisibleCustomFields(allFields);
      return allFields;
    } catch (error) {
      console.error('[TicketForm] Error loading custom fields:', error);
      setVisibleCustomFields([]);
      return [];
    } finally {
      setLoadingFields(false);
    }
  }, [formData.service_id, selectedServices]);

  useEffect(() => {
    loadVisibleFields();
  }, [loadVisibleFields]);

  const availableTicketServices = userFilteredTicketServices.length > 0 ? userFilteredTicketServices : userFilteredServices;

  const getStepLabels = () => {
    if (classificationMode === 'manual') {
      const labels = ['Услуга'];
      if (hasServiceItems) labels.push('Сервис');
      if (visibleCustomFields.length > 0) labels.push('Доп. поля');
      labels.push('Описание');
      return labels;
    }
    const labels = ['Описание', 'Категория'];
    if (visibleCustomFields.length > 0) labels.push('Доп. поля');
    return labels;
  };

  const stepLabels = getStepLabels();
  const totalSteps = stepLabels.length;

  const displayStep = (() => {
    if (classificationMode === 'manual') {
      const existingSteps = [
        1,
        hasServiceItems ? 2 : null,
        visibleCustomFields.length > 0 ? 3 : null,
        MANUAL_DESCRIPTION_STEP,
      ].filter((s): s is number => s !== null);
      const idx = existingSteps.indexOf(step);
      return idx >= 0 ? idx + 1 : existingSteps.filter((s) => s <= step).length;
    }
    return step;
  })();

  return {
    step,
    displayStep,
    hasServiceItems,
    classifying,
    classification,
    clarifyingAnswers,
    setClarifyingAnswers,
    visibleCustomFields,
    loadingFields,
    classificationMode,
    fileUploader,
    selectedServices,
    selectedTicketService,
    filteredServices,
    availableTicketServices,
    stepLabels,
    totalSteps,
    handleDialogChange,
    handleNextFromDescription,
    handleChangeTicketService,
    toggleService,
    getCustomFieldsStep,
    handleNextFromClassify,
    handleNextFromManualService,
    handleNextFromManualServiceItems,
    handleNextFromManualCustomFields,
    handleBack,
    onSubmit,
    isSubmitting,
  };
};
