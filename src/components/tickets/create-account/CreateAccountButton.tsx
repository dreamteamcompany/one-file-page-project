import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import CreateAccountModal, { AccountTarget, AccountInitialValues } from './CreateAccountModal';
import { FN } from '@/config/backend';

const CREATE_ACCOUNT_URL = FN.CREATE_ACCOUNT;

interface CreateAccountButtonProps {
  ticketId?: number;
}

const CreateAccountButton = ({ ticketId }: CreateAccountButtonProps) => {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [targets, setTargets] = useState<AccountTarget[]>(['bitrix', 'email']);
  const [initialValues, setInitialValues] = useState<AccountInitialValues | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const openWith = (t: AccountTarget[], values: AccountInitialValues | null = null) => {
    setTargets(t);
    setInitialValues(values);
    setModalOpen(true);
  };

  const handleAnalyze = async () => {
    if (!ticketId) return;
    setAnalyzing(true);
    try {
      const res = await apiFetch(CREATE_ACCOUNT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'analyze_ticket', ticket_id: ticketId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data?.error || 'Не удалось проанализировать заявку', variant: 'destructive' });
        return;
      }
      const confidencePct = Math.round((Number(data.confidence) || 0) * 100);
      const withConfidence = (text: string) =>
        confidencePct ? `${text} · уверенность ИИ: ${confidencePct}%` : text;

      if (!data.needs_account) {
        toast({
          title: 'Учётная запись не требуется',
          description: withConfidence(data.reason || 'ИИ не нашёл в заявке запрос на создание учётки.'),
        });
        return;
      }
      const f = data.fields || {};
      const direct = data.direct || {};
      openWith(['bitrix', 'email'], {
        lastName: f.last_name || '',
        firstName: f.first_name || '',
        middleName: f.middle_name || '',
        position: f.position || '',
        department: f.department || '',
        departments: Array.isArray(f.departments) ? f.departments : [],
        heads: Array.isArray(f.heads) ? f.heads : [],
        city: f.city || '',
        gender: f.gender || '',
        phone: f.phone || '',
        birthDate: f.birth_date || '',
        hireDate: f.hire_date || '',
        portal: data.portal || '',
        departmentId: direct.department_id || '',
        departmentName: direct.department_name || '',
        positionId: direct.position_id || '',
        positionName: direct.position_name || '',
        photoUrl: direct.photo_url || '',
      });
      toast({
        title: 'ИИ заполнил форму',
        description: withConfidence(data.reason || 'Проверьте данные и создайте учётную запись.'),
      });
    } catch {
      toast({ title: 'Ошибка соединения с ИИ', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {ticketId && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleAnalyze}
          disabled={analyzing}
          className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold dark:border-indigo-400/60 dark:text-indigo-200 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20"
        >
          <Icon
            name={analyzing ? 'Loader2' : 'Sparkles'}
            size={16}
            className={analyzing ? 'mr-1.5 animate-spin' : 'mr-1.5'}
          />
          <span className="hidden sm:inline">Анализ ИИ</span>
          <span className="sm:hidden">ИИ</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-md shadow-blue-500/30"
          >
            <Icon name="UserPlus" size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Создать учётную запись</span>
            <span className="sm:hidden">Учётка</span>
            <Icon name="ChevronDown" size={14} className="ml-1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openWith(['bitrix', 'email'])}>
            <Icon name="LayoutGrid" size={16} className="mr-2" />
            Битрикс + корпоративная почта
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateAccountModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        targets={targets}
        ticketId={ticketId}
        initialValues={initialValues}
      />
    </div>
  );
};

export default CreateAccountButton;