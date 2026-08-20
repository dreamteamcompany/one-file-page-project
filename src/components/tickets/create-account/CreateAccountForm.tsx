import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import FilterCombobox, { FilterComboboxOption } from '@/components/tickets/FilterCombobox';

interface CreateAccountFormProps {
  portal: 'ru' | 'kz' | '';
  setPortal: (v: 'ru' | 'kz' | '') => void;
  domainsLoading: boolean;
  domainsError: string;
  domains: string[];
  domain: string;
  setDomain: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  firstName: string;
  setFirstName: (v: string) => void;
  middleName: string;
  setMiddleName: (v: string) => void;
  birthDate: string;
  setBirthDate: (v: string) => void;
  hireDate: string;
  setHireDate: (v: string) => void;
  position: string;
  setPosition: (v: string) => void;
  positionOptions: FilterComboboxOption[];
  departmentOptions: FilterComboboxOption[];
  departmentList: string[];
  addDepartment: (name: string) => void;
  removeDepartment: (name: string) => void;
  heads: string[];
  removeHead: (name: string) => void;
  city: string;
  setCity: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  gender: 'male' | 'female' | '';
  setGender: (v: 'male' | 'female' | '') => void;
  photoPreview: string;
  handlePhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  handleClose: (next: boolean) => void;
  handleSubmit: () => void;
}

const CreateAccountForm = ({
  portal,
  setPortal,
  domainsLoading,
  domainsError,
  domains,
  domain,
  setDomain,
  lastName,
  setLastName,
  firstName,
  setFirstName,
  middleName,
  setMiddleName,
  birthDate,
  setBirthDate,
  hireDate,
  setHireDate,
  position,
  setPosition,
  positionOptions,
  departmentOptions,
  departmentList,
  addDepartment,
  removeDepartment,
  heads,
  removeHead,
  city,
  setCity,
  phone,
  setPhone,
  gender,
  setGender,
  photoPreview,
  handlePhoto,
  loading,
  handleClose,
  handleSubmit,
}: CreateAccountFormProps) => (
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
        <Label>Отделы</Label>
        <FilterCombobox
          options={departmentOptions}
          value=""
          onChange={addDepartment}
          placeholder="Добавить отдел"
          searchPlaceholder="Поиск отдела..."
          emptyText="Отдел не найден"
        />
        {departmentList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {departmentList.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 text-blue-600 px-2 py-1 text-xs"
              >
                {d}
                <button
                  type="button"
                  onClick={() => removeDepartment(d)}
                  className="hover:text-red-500"
                  aria-label={`Удалить отдел ${d}`}
                >
                  <Icon name="X" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        {heads.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <span className="text-xs text-muted-foreground">По руководителям:</span>
            {heads.map((h) => (
              <span
                key={h}
                className="inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground px-2 py-1 text-xs"
              >
                <Icon name="UserCog" size={12} />
                {h}
                <button
                  type="button"
                  onClick={() => removeHead(h)}
                  className="hover:text-red-500"
                  aria-label={`Убрать руководителя ${h}`}
                >
                  <Icon name="X" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground pt-1">
          Сотрудник будет добавлен во все указанные отделы. По руководителям отдел определяется автоматически в Битрикс.
        </p>
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
);

export default CreateAccountForm;
