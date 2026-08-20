export const CREATE_ACCOUNT_URL = 'https://functions.poehali.dev/30868c2a-0677-4a5e-b668-e78c5d7f918a';

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
