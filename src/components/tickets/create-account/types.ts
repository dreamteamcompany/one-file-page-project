import { FN } from '@/config/backend';
export const CREATE_ACCOUNT_URL = FN.CREATE_ACCOUNT;

export type AccountTarget = 'bitrix' | 'email';

export interface AccountResult {
  system: string;
  title: string;
  login: string;
  password: string;
  url?: string;
  status?: string;
  error?: string;
}

export interface AccountInitialValues {
  lastName?: string;
  firstName?: string;
  middleName?: string;
  position?: string;
  department?: string;
  departments?: string[];
  heads?: string[];
  city?: string;
  gender?: 'male' | 'female' | '';
  phone?: string;
  birthDate?: string;
  hireDate?: string;
  portal?: 'ru' | 'kz' | '';
  departmentId?: string;
  departmentName?: string;
  positionId?: string;
  positionName?: string;
  photoUrl?: string;
}

export interface CreateAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: AccountTarget[];
  ticketId?: number;
  initialValues?: AccountInitialValues | null;
}

export interface Dict {
  id: number;
  name: string;
}
