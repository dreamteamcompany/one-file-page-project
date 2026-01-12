import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePlannedPaymentsData } from '@/hooks/usePlannedPaymentsData';
import { usePlannedPaymentForm } from '@/hooks/usePlannedPaymentForm';
import { useSidebarTouch } from '@/hooks/useSidebarTouch';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import PaymentsHeader from '@/components/payments/PaymentsHeader';
import PaymentsSearch from '@/components/payments/PaymentsSearch';
import PlannedPaymentForm from '@/components/payments/PlannedPaymentForm';
import PaymentsList from '@/components/payments/PaymentsList';
import PaymentDetailsModal from '@/components/payments/PaymentDetailsModal';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
}

interface Payment {
  id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  description: string;
  amount: number;
  payment_date?: string;
  planned_date?: string;
  legal_entity_id?: number;
  legal_entity_name?: string;
  status?: string;
  created_by?: number;
  created_by_name?: string;
  service_id?: number;
  service_name?: string;
  service_description?: string;
  contractor_name?: string;
  contractor_id?: number;
  department_name?: string;
  department_id?: number;
  invoice_number?: string;
  invoice_date?: string;
  created_at?: string;
  submitted_at?: string;
  custom_fields?: CustomField[];
}

const PlannedPayments = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
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
  } = usePlannedPaymentsData();

  const handleFormOpen = () => {
    loadCategories();
    loadLegalEntities();
    loadContractors();
    loadCustomerDepartments();
    loadCustomFields();
    loadServices();
  };

  const {
    dialogOpen,
    setDialogOpen,
    formData,
    setFormData,
    handleSubmit,
  } = usePlannedPaymentForm(customFields, loadPayments);

  const {
    menuOpen,
    setMenuOpen,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSidebarTouch();

  const handleConvertToPayment = async (paymentId: number) => {
    try {
      const response = await fetch('https://functions.poehali.dev/a0000b1e-3d3e-4094-b08e-2893df500d3f', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token || '',
        },
        body: JSON.stringify({ action: 'convert', payment_id: paymentId }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Платёж создан из запланированного',
        });
        loadPayments();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось конвертировать платёж',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to convert payment:', err);
      toast({
        title: 'Ошибка сети',
        description: 'Проверьте подключение к интернету',
        variant: 'destructive',
      });
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        payment.description.toLowerCase().includes(query) ||
        payment.category_name.toLowerCase().includes(query) ||
        payment.amount.toString().includes(query) ||
        payment.service_name?.toLowerCase().includes(query) ||
        payment.contractor_name?.toLowerCase().includes(query) ||
        payment.legal_entity_name?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }
    return true;
  });

  return (
    <div className="flex min-h-screen">
      <PaymentsSidebar
        menuOpen={menuOpen}
        dictionariesOpen={dictionariesOpen}
        setDictionariesOpen={setDictionariesOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
      />

      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="lg:ml-[250px] p-4 md:p-6 lg:p-[30px] min-h-screen flex-1 overflow-x-hidden max-w-full">
        <PaymentsHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

        <PaymentsSearch searchQuery={searchQuery} onSearchChange={setSearchQuery} />

        <PlannedPaymentForm
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
          formData={formData}
          setFormData={setFormData}
          categories={categories}
          legalEntities={legalEntities}
          contractors={contractors}
          customerDepartments={customerDepartments}
          customFields={customFields}
          services={services}
          handleSubmit={handleSubmit}
          onDialogOpen={handleFormOpen}
        />

        <PaymentsList 
          payments={filteredPayments} 
          loading={loading} 
          onSubmitForApproval={handleConvertToPayment}
          onPaymentClick={setSelectedPayment}
          isPlannedPayments
        />

        <PaymentDetailsModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      </main>
    </div>
  );
};

export default PlannedPayments;