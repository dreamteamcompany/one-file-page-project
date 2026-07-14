import { UploadedAttachment } from '@/hooks/useFileUploader';

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface Priority {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface Status {
  id: number;
  name: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface CustomField {
  id: number;
  name: string;
  field_type: string;
  is_required: boolean;
  options?: string[];
  placeholder?: string;
  label?: string;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  ticket_title?: string;
  category_id?: number;
  category_name?: string;
  service_ids?: number[];
  visible_to_user_ids?: number[];
}

export interface ClassificationResult {
  ticket_service_id: number;
  service_ids: number[];
  ticket_service_name: string;
  service_names: string[];
  confidence: number;
  clarifying_questions?: string[];
}

export interface FormData {
  title: string;
  description: string;
  category_id: string;
  priority_id: string;
  status_id: string;
  service_id: string;
  service_ids: number[];
  due_date: string;
  custom_fields: Record<string, string>;
}

export interface TicketFormProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  formData: FormData;
  setFormData: (data: Record<string, string | number | number[] | Record<string, string>>) => void;
  categories: Category[];
  priorities: Priority[];
  statuses: Status[];
  departments: Department[];
  customFields: CustomField[];
  services: Service[];
  ticketServices?: Service[];
  handleSubmit: (
    e: React.FormEvent,
    overrideData?: Record<string, string | number | number[] | Record<string, string>>,
    attachments?: UploadedAttachment[],
  ) => Promise<void>;
  onDialogOpen?: () => void;
  canCreate?: boolean;
}