import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
}

interface PlannedPayment {
  id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  description: string;
  amount: number;
  planned_date: string;
  legal_entity_id?: number;
  legal_entity_name?: string;
  contractor_name?: string;
  contractor_id?: number;
  department_name?: string;
  department_id?: number;
  service_id?: number;
  service_name?: string;
  service_description?: string;
  invoice_number?: string;
  invoice_date?: string;
  recurrence_type?: string;
  recurrence_end_date?: string;
  is_active?: boolean;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  converted_to_payment_id?: number;
  converted_at?: string;
  custom_fields?: CustomField[];
}

interface Category {
  id: number;
  name: string;
  icon: string;
  total_amount?: number;
  payment_count?: number;
}

interface LegalEntity {
  id: number;
  name: string;
}

interface Contractor {
  id: number;
  name: string;
}

interface CustomerDepartment {
  id: number;
  name: string;
}

interface Service {
  id: number;
  name: string;
  description?: string;
}

interface CustomFieldDefinition {
  id: number;
  name: string;
  field_type: string;
  is_required: boolean;
}

export const usePlannedPaymentsData = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<PlannedPayment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [customerDepartments, setCustomerDepartments] = useState<CustomerDepartment[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState({
    categories: false,
    legalEntities: false,
    contractors: false,
    customerDepartments: false,
    customFields: false,
    services: false,
  });

  const loadPayments = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=planned-payments', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (err) {
      console.error('Failed to load planned payments:', err);
    }
  };

  const loadCategories = async () => {
    if (dataLoaded.categories) return;
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=categories', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data);
        setDataLoaded(prev => ({ ...prev, categories: true }));
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadLegalEntities = async () => {
    if (dataLoaded.legalEntities) return;
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=legal-entities', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLegalEntities(data);
        setDataLoaded(prev => ({ ...prev, legalEntities: true }));
      }
    } catch (err) {
      console.error('Failed to load legal entities:', err);
    }
  };

  const loadContractors = async () => {
    if (dataLoaded.contractors) return;
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=contractors', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setContractors(data);
        setDataLoaded(prev => ({ ...prev, contractors: true }));
      }
    } catch (err) {
      console.error('Failed to load contractors:', err);
    }
  };

  const loadCustomerDepartments = async () => {
    if (dataLoaded.customerDepartments) return;
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=customer-departments', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCustomerDepartments(data);
        setDataLoaded(prev => ({ ...prev, customerDepartments: true }));
      }
    } catch (err) {
      console.error('Failed to load customer departments:', err);
    }
  };

  const loadCustomFields = async () => {
    if (dataLoaded.customFields) return;
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=custom-fields', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCustomFields(data);
        setDataLoaded(prev => ({ ...prev, customFields: true }));
      }
    } catch (err) {
      console.error('Failed to load custom fields:', err);
    }
  };

  const loadServices = async () => {
    if (dataLoaded.services) return;
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=services', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setServices(data);
        setDataLoaded(prev => ({ ...prev, services: true }));
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  };

  useEffect(() => {
    if (token) {
      setLoading(true);
      loadPayments().finally(() => setLoading(false));
    }
  }, [token]);

  return {
    payments,
    categories,
    legalEntities,
    contractors,
    customerDepartments,
    customFields,
    services,
    loading,
    loadPayments,
    loadCategories,
    loadLegalEntities,
    loadContractors,
    loadCustomerDepartments,
    loadCustomFields,
    loadServices,
  };
};