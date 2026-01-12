import { useEffect, useState } from 'react';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import ContractorsHeader from '@/components/contractors/ContractorsHeader';
import ContractorForm from '@/components/contractors/ContractorForm';
import ContractorsList from '@/components/contractors/ContractorsList';
import { apiFetch } from '@/utils/api';

interface Contractor {
  id: number;
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legal_address: string;
  actual_address: string;
  phone: string;
  email: string;
  contact_person: string;
  bank_name: string;
  bank_bik: string;
  bank_account: string;
  correspondent_account: string;
  notes: string;
  is_active: boolean;
  created_at: string;
}

const Contractors = () => {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    inn: '',
    kpp: '',
    ogrn: '',
    legal_address: '',
    actual_address: '',
    phone: '',
    email: '',
    contact_person: '',
    bank_name: '',
    bank_bik: '',
    bank_account: '',
    correspondent_account: '',
    notes: '',
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

  const loadContractors = () => {
    apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=contractors')
      .then(res => res.json())
      .then(data => {
        setContractors(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load contractors:', err);
        setContractors([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadContractors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=contractors';
      const method = editingContractor ? 'PUT' : 'POST';
      const body = editingContractor 
        ? { ...formData, id: editingContractor.id }
        : formData;

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setDialogOpen(false);
        setEditingContractor(null);
        setFormData({
          name: '',
          inn: '',
          kpp: '',
          ogrn: '',
          legal_address: '',
          actual_address: '',
          phone: '',
          email: '',
          contact_person: '',
          bank_name: '',
          bank_bik: '',
          bank_account: '',
          correspondent_account: '',
          notes: '',
        });
        loadContractors();
      }
    } catch (err) {
      console.error('Failed to save contractor:', err);
    }
  };

  const handleEdit = (contractor: Contractor) => {
    setEditingContractor(contractor);
    setFormData({
      name: contractor.name,
      inn: contractor.inn,
      kpp: contractor.kpp,
      ogrn: contractor.ogrn,
      legal_address: contractor.legal_address,
      actual_address: contractor.actual_address,
      phone: contractor.phone,
      email: contractor.email,
      contact_person: contractor.contact_person,
      bank_name: contractor.bank_name,
      bank_bik: contractor.bank_bik,
      bank_account: contractor.bank_account,
      correspondent_account: contractor.correspondent_account,
      notes: contractor.notes,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого контрагента?')) return;
    
    try {
      const response = await apiFetch(
        `https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=contractors&id=${id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        loadContractors();
      }
    } catch (err) {
      console.error('Failed to delete contractor:', err);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingContractor(null);
      setFormData({
        name: '',
        inn: '',
        kpp: '',
        ogrn: '',
        legal_address: '',
        actual_address: '',
        phone: '',
        email: '',
        contact_person: '',
        bank_name: '',
        bank_bik: '',
        bank_account: '',
        correspondent_account: '',
        notes: '',
      });
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
        <ContractorsHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

        <ContractorForm
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
          editingContractor={editingContractor}
          formData={formData}
          setFormData={setFormData}
          handleSubmit={handleSubmit}
          handleDialogClose={handleDialogClose}
        />

        <ContractorsList
          contractors={contractors}
          loading={loading}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
        />
      </main>
    </div>
  );
};

export default Contractors;