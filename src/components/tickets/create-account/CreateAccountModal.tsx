import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import FilterCombobox, { FilterComboboxOption } from '@/components/tickets/FilterCombobox';

const CREATE_ACCOUNT_URL = 'https://functions.poehali.dev/30868c2a-0677-4a5e-b668-e78c5d7f918a';

export type AccountTarget = 'bitrix' | 'email';

interface AccountResult {
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
  city?: string;
  gender?: 'male' | 'female' | '';
  phone?: string;
  birthDate?: string;
  hireDate?: string;
  portal?: 'ru' | 'kz' | '';
  departmentId?: string;
  positionId?: string;
  photoUrl?: string;
}

interface CreateAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: AccountTarget[];
  ticketId?: number;
  initialValues?: AccountInitialValues | null;
}

interface Dict {
  id: number;
  name: string;
}

const CreateAccountModal = ({ open, onOpenChange, targets, ticketId, initialValues }: CreateAccountModalProps) => {
  const { toast } = useToast();

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [portal, setPortal] = useState<'ru' | 'kz' | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
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
    if (initialValues.departmentId) setDepartment(String(initialValues.departmentId));
    if (initialValues.positionId) setPosition(String(initialValues.positionId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  useEffect(() => {
    if (!open || initialValues?.departmentId) return;
    if (!initialValues?.department || departments.length === 0) return;
    const wanted = initialValues.department.trim().toLowerCase();
    const found =
      departments.find((d) => d.name.trim().toLowerCase() === wanted) ||
      departments.find((d) => d.name.trim().toLowerCase().includes(wanted));
    if (found) setDepartment(String(found.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues, departments]);

  useEffect(() => {
    if (!open || initialValues?.positionId) return;
    if (!initialValues?.position || positions.length === 0) return;
    const wanted = initialValues.position.trim().toLowerCase();
    const found =
      positions.find((p) => p.name.trim().toLowerCase() === wanted) ||
      positions.find((p) => p.name.trim().toLowerCase().includes(wanted));
    if (found) setPosition(String(found.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues, positions]);

  const resetForm = () => {
    setLastName('');
    setFirstName('');
    setMiddleName('');
    setPortal('');
    setBirthDate('');
    setHireDate('');
    setPosition('');
    setDepartment('');
    setCity('');
    setGender('');
    setPhone('');
    setDomain('');
    setDomains([]);
    setDomainsError('');
    setPhotoPreview('');
    setResults(null);
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
          department,
          city,
          gender,
          phone,
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать учётную запись</DialogTitle>
          <DialogDescription>{targetsLabel}</DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Портал *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPortal('ru')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    portal === 'ru'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                >
                  <span className="text-base">🇷🇺</span>
                  Россия
                </button>
                <button
                  type="button"
                  onClick={() => setPortal('kz')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    portal === 'kz'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                >
                  <span className="text-base">🇰🇿</span>
                  Казахстан
                </button>
              </div>
            </div>

            {portal && (
              <div className="space-y-1">
                <Label>Домен почты *</Label>
                {domainsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Icon name="Loader2" size={16} className="animate-spin" />
                    Загружаем домены из панели...
                  </div>
                ) : domainsError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
                    <Icon name="XCircle" size={16} className="mt-0.5 shrink-0" />
                    <span>{domainsError}. Проверьте доступы почты в Настройки → Интеграции.</span>
                  </div>
                ) : (
                  <FilterCombobox
                    options={domains.map((d) => ({ value: d, label: d }))}
                    value={domain}
                    onChange={setDomain}
                    placeholder="Выберите домен"
                    searchPlaceholder="Поиск домена..."
                    emptyText="Домен не найден"
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Фамилия *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Лалиев" />
              </div>
              <div className="space-y-1">
                <Label>Имя *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Роберт" />
              </div>
              <div className="space-y-1">
                <Label>Отчество</Label>
                <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Захарович" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Дата рождения</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Дата приёма на работу</Label>
                <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Должность</Label>
                <FilterCombobox
                  options={positionOptions}
                  value={position}
                  onChange={setPosition}
                  placeholder="Выберите должность"
                  searchPlaceholder="Поиск должности..."
                  emptyText="Должность не найдена"
                />
              </div>
              <div className="space-y-1">
                <Label>Отдел</Label>
                <FilterCombobox
                  options={departmentOptions}
                  value={department}
                  onChange={setDepartment}
                  placeholder="Выберите отдел"
                  searchPlaceholder="Поиск отдела..."
                  emptyText="Отдел не найден"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Город</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" />
              </div>
              <div className="space-y-1">
                <Label>Номер телефона</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 900 000-00-00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Пол</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    gender === 'male'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                >
                  <Icon name="Mars" fallback="User" size={16} />
                  Мужской
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    gender === 'female'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                >
                  <Icon name="Venus" fallback="User" size={16} />
                  Женский
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Фото</Label>
              <div className="flex items-center gap-3">
                {photoPreview ? (
                  <img src={photoPreview} alt="Фото" className="h-14 w-14 rounded-full object-cover border" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Icon name="User" size={22} />
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-2 text-sm rounded-lg border px-3 py-2 hover:bg-muted">
                  <Icon name="Upload" size={16} />
                  Загрузить
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => handleClose(false)} disabled={loading}>
                Отмена
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !portal || !domain}>
                {loading ? (
                  <>
                    <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                    Создаём...
                  </>
                ) : (
                  <>
                    <Icon name="UserPlus" size={16} className="mr-2" />
                    Создать
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {results.some((a) => a.status === 'error') ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-3 py-2 text-sm">
                <Icon name="TriangleAlert" size={18} />
                Часть учётных записей не создана — смотрите детали ниже.
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-3 py-2 text-sm">
                <Icon name="CircleCheck" size={18} />
                Учётные записи созданы. Сохраните данные — пароли показываются один раз.
              </div>
            )}

            {results.map((acc) => (
              <div key={acc.system} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Icon name={acc.system === 'bitrix' ? 'Building2' : 'Mail'} size={16} />
                  {acc.title}
                  {acc.status === 'error' ? (
                    <span className="ml-auto text-xs font-medium text-red-600 dark:text-red-400">Ошибка</span>
                  ) : acc.status === 'created' ? (
                    <span className="ml-auto text-xs font-medium text-green-600 dark:text-green-400">Создан</span>
                  ) : null}
                </div>
                {acc.status === 'error' ? (
                  <div className="rounded-md bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-3 py-2 text-xs">
                    {acc.error || 'Не удалось создать учётную запись'}
                  </div>
                ) : (
                  <>
                    <CredRow
                      label="Логин"
                      value={acc.login}
                      copied={copiedKey === `${acc.system}-login`}
                      onCopy={() => copy(`${acc.system}-login`, acc.login)}
                    />
                    <CredRow
                      label="Пароль"
                      value={acc.password}
                      copied={copiedKey === `${acc.system}-pass`}
                      onCopy={() => copy(`${acc.system}-pass`, acc.password)}
                      mono
                    />
                    {acc.url ? (
                      <CredRow
                        label="Адрес"
                        value={acc.url}
                        copied={copiedKey === `${acc.system}-url`}
                        onCopy={() => copy(`${acc.system}-url`, acc.url || '')}
                      />
                    ) : null}
                  </>
                )}
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleClose(false)}>Готово</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface CredRowProps {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}

const CredRow = ({ label, value, copied, onCopy, mono }: CredRowProps) => (
  <div className="flex items-center justify-between gap-2">
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`truncate text-sm ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCopy} title="Скопировать">
      <Icon name={copied ? 'Check' : 'Copy'} size={16} className={copied ? 'text-green-600' : ''} />
    </Button>
  </div>
);

export default CreateAccountModal;