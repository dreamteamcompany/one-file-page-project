import { useState, useEffect } from 'react';
import { apiFetch, API_URL } from '@/utils/api';
import type {
  Payment,
  PaymentCustomField,
  PaymentCustomFieldDefinition,
  PaymentCategory,
  LegalEntity,
  Contractor,
  CustomerDepartment,
  PaymentService,
} from '@/types';

export const usePaymentsData = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [customerDepartments, setCustomerDepartments] = useState<CustomerDepartment[]>([]);
  const [customFields, setCustomFields] = useState<PaymentCustomFieldDefinition[]>([]);
  const [services, setServices] = useState<PaymentService[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPayments = () => {
    apiFetch(`${API_URL}?endpoint=payments`)
      .then(res => res.json())
      .then(data => {
        setPayments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load payments:', err);
        setPayments([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPayments();
    apiFetch(`${API_URL}?endpoint=categories`)
      .then(res => res.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(err => { console.error('Failed to load categories:', err); setCategories([]); });
    apiFetch(`${API_URL}?endpoint=legal-entities`)
      .then(res => res.json())
      .then(data => setLegalEntities(Array.isArray(data) ? data : []))
      .catch(err => { console.error('Failed to load legal entities:', err); setLegalEntities([]); });
    apiFetch(`${API_URL}?endpoint=contractors`)
      .then(res => res.json())
      .then(data => setContractors(Array.isArray(data) ? data : []))
      .catch(err => { console.error('Failed to load contractors:', err); setContractors([]); });
    apiFetch(`${API_URL}?endpoint=customer_departments`)
      .then(res => res.json())
      .then(data => setCustomerDepartments(Array.isArray(data) ? data : []))
      .catch(err => { console.error('Failed to load customer departments:', err); setCustomerDepartments([]); });
    apiFetch(`${API_URL}?endpoint=services`)
      .then(res => res.json())
      .then(data => setServices(data.services || []))
      .catch(err => { console.error('Failed to load services:', err); setServices([]); });
    apiFetch(`${API_URL}?endpoint=custom-fields`)
      .then(res => res.json())
      .then((fields) => {
        setCustomFields(Array.isArray(fields) ? fields : []);
      })
      .catch(err => { console.error('Failed to load custom fields:', err); setCustomFields([]); });
  }, []);

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
  };
};