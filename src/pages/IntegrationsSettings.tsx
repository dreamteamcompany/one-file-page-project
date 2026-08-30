import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import PageLayout from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { FN } from '@/config/backend';

const API_URL = FN.CREATE_ACCOUNT;

interface SettingField {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  has_value: boolean;
  value: string;
  hint?: string;
}

const IntegrationsSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const roles = (user.roles || []) as Array<string | { system_role?: string; name?: string }>;
    return roles.some((r) =>
      typeof r === 'string'
        ? r === 'admin'
        : r?.system_role === 'admin' || r?.name === 'admin' || r?.name === 'Администратор',
    );
  }, [user]);

  const [fields, setFields] = useState<SettingField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string>('');
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const testConnection = async (service: string) => {
    setTesting(service);
    setTestResults((prev) => ({ ...prev, [service]: undefined as never }));
    try {
      const r = await apiFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'test', service }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setTestResults((prev) => ({ ...prev, [service]: { ok: false, message: data.error || 'Ошибка проверки' } }));
        return;
      }
      setTestResults((prev) => ({ ...prev, [service]: { ok: !!data.ok, message: data.message || '' } }));
    } catch {
      setTestResults((prev) => ({ ...prev, [service]: { ok: false, message: 'Ошибка соединения' } }));
    } finally {
      setTesting('');
    }
  };

  useEffect(() => {
    if (user && !isAdmin) navigate('/settings');
  }, [user, isAdmin, navigate]);

  const load = async () => {
    try {
      const r = await apiFetch(`${API_URL}?action=settings`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast({ title: err.error || 'Не удалось загрузить настройки', variant: 'destructive' });
        return;
      }
      const data = await r.json();
      const list: SettingField[] = data.fields || [];
      setFields(list);
      const init: Record<string, string> = {};
      list.forEach((f) => {
        init[f.key] = f.secret ? '' : f.value || '';
      });
      setValues(init);
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      fields.forEach((f) => {
        const v = values[f.key] ?? '';
        if (f.secret && v === '') return; // пустой секрет — не отправляем
        payload[f.key] = v;
      });
      const r = await apiFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'save_settings', values: payload }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: data.error || 'Не удалось сохранить', variant: 'destructive' });
        return;
      }
      toast({ title: 'Настройки сохранены' });
      await load();
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const groups = useMemo(() => {
    const map: Record<string, SettingField[]> = {};
    fields.forEach((f) => {
      (map[f.group] = map[f.group] || []).push(f);
    });
    return map;
  }, [fields]);

  const fieldService: Record<string, string> = {
    bitrix_webhook_ru: 'bitrix_ru',
    bitrix_webhook_kz: 'bitrix_kz',
  };
  const groupService: Record<string, string> = {
    'Почта РФ (ISPmanager)': 'mail_ru',
    'Почта КЗ (LanCloud)': 'mail_kz',
  };

  const renderTestResult = (service: string) => {
    const res = testResults[service];
    if (!res) return null;
    return (
      <p className={`text-xs mt-1.5 flex items-center gap-1 ${res.ok ? 'text-green-500' : 'text-red-500'}`}>
        <Icon name={res.ok ? 'CheckCircle2' : 'XCircle'} size={13} />
        {res.message}
      </p>
    );
  };

  const TestButton = ({ service }: { service: string }) => (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => testConnection(service)}
      disabled={testing === service}
      className="gap-1.5 h-8"
    >
      <Icon name={testing === service ? 'Loader2' : 'Activity'} size={13} className={testing === service ? 'animate-spin' : ''} />
      Проверить
    </Button>
  );

  if (!isAdmin) return null;

  return (
    <PageLayout>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-2">
            <Icon name="ArrowLeft" size={16} />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Интеграции</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Вебхуки Битрикс и корпоративная почта для порталов РФ и Казахстана
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
          <Icon name={saving ? 'Loader2' : 'Save'} size={16} className={saving ? 'animate-spin' : ''} />
          Сохранить
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(groups).map(([group, groupFields]) => (
            <Card key={group}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon name="Plug" size={18} className="text-primary" />
                    {group}
                  </CardTitle>
                  {groupService[group] && <TestButton service={groupService[group]} />}
                </div>
                {groupService[group] && renderTestResult(groupService[group])}
              </CardHeader>
              <CardContent className="space-y-3">
                {groupFields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="flex items-center gap-2">
                      {f.label}
                      {f.secret && f.has_value && (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <Icon name="CheckCircle2" size={12} />
                          задано
                        </span>
                      )}
                    </Label>
                    <Input
                      type={f.secret ? 'password' : 'text'}
                      value={values[f.key] ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={
                        f.secret
                          ? f.has_value
                            ? '•••••••• (оставьте пустым, чтобы не менять)'
                            : 'Введите значение'
                          : 'Введите значение'
                      }
                      autoComplete="off"
                    />
                    {f.hint && (
                      <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>
                    )}
                    {fieldService[f.key] && (
                      <div className="pt-1">
                        <TestButton service={fieldService[f.key]} />
                        {renderTestResult(fieldService[f.key])}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default IntegrationsSettings;
