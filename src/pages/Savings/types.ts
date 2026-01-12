export interface Saving {
  id: number;
  service_id: number;
  service_name: string;
  description: string;
  amount: number;
  frequency: string;
  currency: string;
  employee_id: number;
  employee_name: string;
  saving_reason_id?: number;
  saving_reason_name?: string;
  customer_department_id?: number;
  customer_department_name?: string;
  created_at: string;
}

export interface Service {
  id: number;
  name: string;
}

export interface Employee {
  id: number;
  full_name: string;
}

export interface SavingReason {
  id: number;
  name: string;
  icon: string;
}

export interface SavingFormData {
  service_id: string;
  description: string;
  amount: string;
  frequency: string;
  currency: string;
  employee_id: string;
  saving_reason_id: string;
  customer_department_id: string;
}

export interface CustomerDepartment {
  id: number;
  name: string;
  description: string;
}