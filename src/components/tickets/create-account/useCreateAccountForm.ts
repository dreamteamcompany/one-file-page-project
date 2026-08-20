import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { FilterComboboxOption } from '@/components/tickets/FilterCombobox';
import {
  AccountInitialValues,
  AccountResult,
  AccountTarget,
  CREATE_ACCOUNT_URL,
  Dict,
} from './types';

interface Params {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: AccountTarget[];
  ticketId?: number;
  initialValues?: AccountInitialValues | null;
}

export const useCreateAccountForm = ({
  open,
  onOpenChange,
  targets,
  ticketId,
  initialValues,
}: Params) => {
  const { toast } = useToast();

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [portal, setPortal] = useState<'ru' | 'kz' | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [position, setPosition] = useState('');
  const [departmentList, setDepartmentList] = useState<string[]>([]);
  const [heads, setHeads] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [phone, setPhone] = useState('');
  const [domain, setDomain] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');

  const [departments, setDepartments] = useState<Dict[]>([]);
  const [positions, setPositions] = useState<Dict[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domainsError, setDomainsError] = useState('');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AccountResult[] | null>(null);
  const [resultDepartments, setResultDepartments] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    if (!open) return;
    apiFetch('/departments')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => {});
    apiFetch('/positions')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPositions(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    setDomain('');
    setDomains([]);
    setDomainsError('');
    if (!open || !portal) return;
    setDomainsLoading(true);
    apiFetch(CREATE_ACCOUNT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'list_domains', portal }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setDomainsError(data.error || 'Не удалось получить список доменов');
          return;
        }
        const list: string[] = data.domains || [];
        setDomains(list);
        const preferred = list.find((d) => d.toLowerCase() === 'dreamteamcompany.ru');
        if (preferred) setDomain(preferred);
        else if (list.length === 1) setDomain(list[0]);
        if (list.length === 0) setDomainsError('Список доменов пуст');
      })
      .catch(() => setDomainsError('Ошибка соединения при получении доменов'))
      .finally(() => setDomainsLoading(false));
  }, [open, portal]);

  useEffect(() => {
    if (!open || !initialValues) return;
    if (initialValues.lastName !== undefined) setLastName(initialValues.lastName);
    if (initialValues.firstName !== undefined) setFirstName(initialValues.firstName);
    if (initialValues.middleName !== undefined) setMiddleName(initialValues.middleName);
    if (initialValues.city !== undefined) setCity(initialValues.city);
    if (initialValues.gender !== undefined) setGender(initialValues.gender);
    if (initialValues.phone !== undefined) setPhone(initialValues.phone);
    if (initialValues.birthDate !== undefined) setBirthDate(initialValues.birthDate);
    if (initialValues.hireDate !== undefined) setHireDate(initialValues.hireDate);
    if (initialValues.portal) setPortal(initialValues.portal);
    if (initialValues.photoUrl) setPhotoPreview(initialValues.photoUrl);
    // FilterCombobox хранит значение по названию (label), поэтому кладём имена, а не ID
    const depNames: string[] = [];
    const pushDep = (name?: string) => {
      const n = (name || '').trim();
      if (n && !depNames.some((x) => x.toLowerCase() === n.toLowerCase())) depNames.push(n);
    };
    pushDep(initialValues.departmentName);
    (initialValues.departments || []).forEach(pushDep);
    pushDep(initialValues.department);
    setDepartmentList(depNames);
    setHeads(initialValues.heads || []);
    if (initialValues.positionName) setPosition(initialValues.positionName);
    else if (initialValues.position) setPosition(initialValues.position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  const resetForm = () => {
    setLastName('');
    setFirstName('');
    setMiddleName('');
    setPortal('');
    setBirthDate('');
    setHireDate('');
    setPosition('');
    setDepartmentList([]);
    setHeads([]);
    setCity('');
    setGender('');
    setPhone('');
    setDomain('');
    setDomains([]);
    setDomainsError('');
    setPhotoPreview('');
    setResults(null);
    setResultDepartments([]);
  };

  const handleClose = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!portal) {
      toast({ title: 'Выберите портал', variant: 'destructive' });
      return;
    }
    if (!lastName.trim() || !firstName.trim()) {
      toast({ title: 'Укажите фамилию и имя', variant: 'destructive' });
      return;
    }
    if (!domain) {
      toast({ title: 'Выберите домен почты', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(CREATE_ACCOUNT_URL, {
        method: 'POST',
        body: JSON.stringify({
          portal,
          domain,
          last_name: lastName,
          first_name: firstName,
          middle_name: middleName,
          birth_date: birthDate,
          hire_date: hireDate,
          position,
          departments: departmentList,
          heads,
          city,
          gender,
          phone,
          photo_url: photoPreview,
          targets,
          ticket_id: ticketId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data?.error || 'Не удалось создать учётную запись', variant: 'destructive' });
        return;
      }
      setResults(data.accounts || []);
      setResultDepartments(
        Array.isArray(data.employee?.departments) ? data.employee.departments : [],
      );
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  const targetsLabel = targets
    .map((t) => (t === 'bitrix' ? 'Битрикс' : 'Корпоративная почта'))
    .join(' + ');

  const positionOptions: FilterComboboxOption[] = positions.map((p) => ({ value: String(p.id), label: p.name }));
  const departmentOptions: FilterComboboxOption[] = departments.map((d) => ({ value: String(d.id), label: d.name }));

  const addDepartment = (name: string) => {
    const n = (name || '').trim();
    if (!n) return;
    setDepartmentList((prev) =>
      prev.some((x) => x.toLowerCase() === n.toLowerCase()) ? prev : [...prev, n],
    );
  };
  const removeDepartment = (name: string) => {
    setDepartmentList((prev) => prev.filter((x) => x !== name));
  };
  const removeHead = (name: string) => {
    setHeads((prev) => prev.filter((x) => x !== name));
  };

  return {
    lastName,
    setLastName,
    firstName,
    setFirstName,
    middleName,
    setMiddleName,
    portal,
    setPortal,
    birthDate,
    setBirthDate,
    hireDate,
    setHireDate,
    position,
    setPosition,
    departmentList,
    heads,
    city,
    setCity,
    gender,
    setGender,
    phone,
    setPhone,
    domain,
    setDomain,
    photoPreview,
    domains,
    domainsLoading,
    domainsError,
    loading,
    results,
    resultDepartments,
    copiedKey,
    handleClose,
    handlePhoto,
    handleSubmit,
    copy,
    targetsLabel,
    positionOptions,
    departmentOptions,
    addDepartment,
    removeDepartment,
    removeHead,
  };
};
