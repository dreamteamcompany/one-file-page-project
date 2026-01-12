import { useEffect, useState } from 'react';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';
import SavingFormDialog from './Savings/SavingFormDialog';
import SavingsTable from './Savings/SavingsTable';
import { Saving, Service, Employee, SavingReason, SavingFormData, CustomerDepartment } from './Savings/types';

const Savings = () => {
  const [savings, setSavings] = useState<Saving[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [savingReasons, setSavingReasons] = useState<SavingReason[]>([]);
  const [departments, setDepartments] = useState<CustomerDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const { token } = useAuth();

  const [formData, setFormData] = useState<SavingFormData>({
    service_id: '',
    description: '',
    amount: '',
    frequency: 'once',
    currency: 'RUB',
    employee_id: '',
    saving_reason_id: '',
    customer_department_id: '',
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      setMenuOpen(false);
    }
  };

  const loadSavings = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=savings', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSavings(Array.isArray(data) ? data : []);
      } else {
        setSavings([]);
      }
    } catch (err) {
      console.error('Failed to load savings:', err);
      setSavings([]);
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=services', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Savings] Loaded services:', data);
        console.log('[Savings] Is array?', Array.isArray(data));
        console.log('[Savings] Type:', typeof data);
        
        const servicesList = data.services || data;
        console.log('[Savings] Services list:', servicesList);
        
        setServices(Array.isArray(servicesList) ? servicesList : []);
      } else {
        console.error('[Savings] Failed to load services, status:', response.status);
      }
    } catch (err) {
      console.error('[Savings] Failed to load services:', err);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=users', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const employeesList = data.users || data;
        setEmployees(Array.isArray(employeesList) ? employeesList : []);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  const loadSavingReasons = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=saving-reasons', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSavingReasons(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load saving reasons:', err);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=customer-departments', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  useEffect(() => {
    loadSavings();
    loadServices();
    loadEmployees();
    loadSavingReasons();
    loadDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=savings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token || '',
        },
        body: JSON.stringify({
          service_id: parseInt(formData.service_id),
          description: formData.description,
          amount: parseFloat(formData.amount),
          frequency: formData.frequency,
          currency: formData.currency,
          employee_id: parseInt(formData.employee_id),
          saving_reason_id: formData.saving_reason_id ? parseInt(formData.saving_reason_id) : null,
          customer_department_id: formData.customer_department_id ? parseInt(formData.customer_department_id) : null,
        }),
      });

      if (response.ok) {
        setDialogOpen(false);
        setFormData({
          service_id: '',
          description: '',
          amount: '',
          frequency: 'once',
          currency: 'RUB',
          employee_id: '',
          saving_reason_id: '',
          customer_department_id: '',
        });
        loadSavings();
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка при сохранении экономии');
      }
    } catch (err) {
      console.error('Failed to save saving:', err);
      alert('Ошибка при сохранении экономии');
    }
  };

  const handleDeleteSaving = async (savingId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту запись об экономии?')) return;
    
    try {
      const response = await fetch(`https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=savings&id=${savingId}`, {
        method: 'DELETE',
        headers: {
          'X-Auth-Token': token || '',
        },
      });

      if (response.ok) {
        loadSavings();
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка при удалении');
      }
    } catch (err) {
      console.error('Failed to delete saving:', err);
      alert('Ошибка при удалении');
    }
  };

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
        <div className="flex justify-between items-center mb-6">
          <button
            className="lg:hidden p-2 hover:bg-primary/10 rounded-lg transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="Menu" size={24} className="text-muted-foreground" />
          </button>
          <div className="flex-1 lg:flex-none" />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Реестр экономии</h1>
            <p className="text-sm md:text-base text-muted-foreground">Учёт и управление экономией средств</p>
          </div>
          <SavingFormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            formData={formData}
            setFormData={setFormData}
            services={services}
            employees={employees}
            savingReasons={savingReasons}
            departments={departments}
            onSubmit={handleSubmit}
          />
        </div>

        <SavingsTable
          savings={savings}
          loading={loading}
          onDeleteSaving={handleDeleteSaving}
        />
      </main>
    </div>
  );
};

export default Savings;