import { useState, useMemo } from 'react';

interface Payment {
  id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  description: string;
  amount: number;
  payment_date: string;
  legal_entity_id?: number;
  legal_entity_name?: string;
  status?: string;
  created_by?: number;
  created_by_name?: string;
  service_id?: number;
  service_name?: string;
  contractor_name?: string;
  contractor_id?: number;
  department_name?: string;
  department_id?: number;
  invoice_number?: string;
  invoice_date?: string;
  created_at?: string;
  submitted_at?: string;
}

export const usePendingApprovalsFilters = (payments: Payment[]) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [amountFrom, setAmountFrom] = useState<string>('');
  const [amountTo, setAmountTo] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (
          payment.description.toLowerCase().includes(query) ||
          payment.category_name.toLowerCase().includes(query) ||
          payment.amount.toString().includes(query) ||
          payment.service_name?.toLowerCase().includes(query) ||
          payment.contractor_name?.toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }

      if (selectedService !== 'all' && payment.service_id?.toString() !== selectedService) {
        return false;
      }

      if (amountFrom && payment.amount < parseFloat(amountFrom)) {
        return false;
      }

      if (amountTo && payment.amount > parseFloat(amountTo)) {
        return false;
      }

      if (dateFrom && new Date(payment.payment_date) < new Date(dateFrom)) {
        return false;
      }

      if (dateTo && new Date(payment.payment_date) > new Date(dateTo)) {
        return false;
      }

      return true;
    });
  }, [payments, searchQuery, selectedService, amountFrom, amountTo, dateFrom, dateTo]);

  const activeFiltersCount = useMemo(() => {
    return [
      selectedService !== 'all',
      amountFrom !== '',
      amountTo !== '',
      dateFrom !== '',
      dateTo !== '',
    ].filter(Boolean).length;
  }, [selectedService, amountFrom, amountTo, dateFrom, dateTo]);

  const clearFilters = () => {
    setSelectedService('all');
    setAmountFrom('');
    setAmountTo('');
    setDateFrom('');
    setDateTo('');
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedService,
    setSelectedService,
    amountFrom,
    setAmountFrom,
    amountTo,
    setAmountTo,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showFilters,
    setShowFilters,
    filteredPayments,
    activeFiltersCount,
    clearFilters,
  };
};
