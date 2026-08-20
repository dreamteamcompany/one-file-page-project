import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AccountResult } from './types';

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
    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCopy} title="Скопировать" aria-label="Скопировать">
      <Icon name={copied ? 'Check' : 'Copy'} size={16} className={copied ? 'text-green-600' : ''} />
    </Button>
  </div>
);

interface CreateAccountResultsProps {
  results: AccountResult[];
  resultDepartments: string[];
  copiedKey: string;
  copy: (key: string, value: string) => void;
  handleClose: (next: boolean) => void;
}

const CreateAccountResults = ({
  results,
  resultDepartments,
  copiedKey,
  copy,
  handleClose,
}: CreateAccountResultsProps) => (
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

    {resultDepartments.length > 0 && (
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Icon name="Building2" size={16} />
          Отделы сотрудника
        </div>
        <div className="flex flex-wrap gap-1.5">
          {resultDepartments.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 text-blue-600 px-2 py-1 text-xs"
            >
              <Icon name="Check" size={12} />
              {d}
            </span>
          ))}
        </div>
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
);

export default CreateAccountResults;
