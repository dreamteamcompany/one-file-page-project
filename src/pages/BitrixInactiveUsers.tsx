import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import PageLayout from '@/components/layout/PageLayout';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FN } from '@/config/backend';
import BlockReportModal, { BlockReport } from './bitrix-inactive-users/BlockReportModal';
import {
  InactiveUser,
  ApiResponse,
  ExceptionItem,
  BitrixSearchUser,
  ReportListItem,
  DeactivateMode,
} from './bitrix-inactive-users/types';
import InactiveUsersTab from './bitrix-inactive-users/InactiveUsersTab';
import ExceptionsTab from './bitrix-inactive-users/ExceptionsTab';
import ReportsTab from './bitrix-inactive-users/ReportsTab';
import BitrixPageHeader from './bitrix-inactive-users/BitrixPageHeader';
import DeactivateConfirmDialog from './bitrix-inactive-users/DeactivateConfirmDialog';
import RemoveExceptionDialog from './bitrix-inactive-users/RemoveExceptionDialog';
import AddExceptionDialog from './bitrix-inactive-users/AddExceptionDialog';

const API_URL = FN.BITRIX_INACTIVE_USERS;

const BitrixInactiveUsers = () => {
  const { toast } = useToast();
  const { hasSystemRole } = useAuth();
  const isAdmin = hasSystemRole('admin');

  const [tab, setTab] = useState<'inactive' | 'exceptions' | 'reports'>('inactive');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [confirmMode, setConfirmMode] = useState<DeactivateMode | null>(null);

  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [excSearch, setExcSearch] = useState('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bxQuery, setBxQuery] = useState('');
  const [bxResults, setBxResults] = useState<BitrixSearchUser[]>([]);
  const [bxSearching, setBxSearching] = useState(false);
  const [selectedBx, setSelectedBx] = useState<BitrixSearchUser | null>(null);
  const [reason, setReason] = useState('');
  const [savingException, setSavingException] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<ExceptionItem | null>(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<BlockReport | null>(null);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);



  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}?action=reports`);
      if (res.ok) {
        const json = await res.json();
        setReports(json.reports || []);
      }
    } finally {
      setReportsLoading(false);
    }
  };

  const openReportById = async (id: number) => {
    try {
      const res = await apiFetch(`${API_URL}?action=report&id=${id}`);
      if (res.ok) {
        const json = await res.json();
        setActiveReport(json.report);
        setReportModalOpen(true);
      } else {
        toast({ title: 'Не удалось загрузить отчёт', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Не удалось подключиться', variant: 'destructive' });
    }
  };

  const loadData = async (d: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`${API_URL}?days=${d}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Ошибка загрузки');
      }
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  const loadExceptions = async () => {
    setExceptionsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}?action=exceptions`);
      if (res.ok) {
        const json = await res.json();
        setExceptions(json.exceptions || []);
      }
    } finally {
      setExceptionsLoading(false);
    }
  };

  useEffect(() => {
    loadData(days);
    loadExceptions();
    loadReports();
  }, []);

  const handleSearch = () => {
    loadData(days);
  };

  const neverLoggedCount = data?.users.filter(u => u.days_inactive === null && !u.is_excluded).length || 0;
  const longInactiveCount = data?.users.filter(u => u.days_inactive !== null && !u.is_excluded).length || 0;
  const visibleInactiveCount = data?.users.filter(u => !u.is_excluded).length || 0;

  const getConfirmCount = (mode: DeactivateMode) => {
    if (mode === 'all') return visibleInactiveCount;
    if (mode === 'never_logged') return neverLoggedCount;
    return longInactiveCount;
  };

  const handleDeactivate = async () => {
    if (!confirmMode) return;
    setDeactivating(true);
    try {
      const res = await apiFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ mode: confirmMode, days }),
      });
      if (res.ok) {
        const result = await res.json();
        let title = `Деактивировано: ${result.deactivated} из ${result.total_requested}`;
        if (result.skipped_excluded) {
          title += ` (пропущено из исключений: ${result.skipped_excluded})`;
        }
        toast({ title });
        if (result.errors?.length > 0) {
          toast({ title: `Ошибки: ${result.errors.length}`, variant: 'destructive' });
        }
        if (result.report) {
          setActiveReport(result.report);
          setReportModalOpen(true);
        }
        loadData(days);
        loadReports();
      } else {
        toast({ title: 'Ошибка деактивации', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Не удалось подключиться к серверу', variant: 'destructive' });
    } finally {
      setDeactivating(false);
      setConfirmMode(null);
    }
  };

  const handleAddToExceptions = async (user: InactiveUser) => {
    try {
      const res = await apiFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'add_exception',
          bitrix_user_id: user.id,
          full_name: user.name,
          email: user.email,
          position: user.position,
        }),
      });
      if (res.ok) {
        toast({ title: 'Добавлен в исключения' });
        loadData(days);
        loadExceptions();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Ошибка', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Не удалось подключиться', variant: 'destructive' });
    }
  };

  const handleRemoveException = async () => {
    if (!removeTarget) return;
    try {
      const res = await apiFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'remove_exception',
          bitrix_user_id: removeTarget.bitrix_user_id,
        }),
      });
      if (res.ok) {
        toast({ title: 'Удалено из исключений' });
        loadExceptions();
        loadData(days);
      } else {
        toast({ title: 'Ошибка', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Не удалось подключиться', variant: 'destructive' });
    } finally {
      setRemoveTarget(null);
    }
  };

  useEffect(() => {
    if (!addModalOpen) return;
    const q = bxQuery.trim();
    if (q.length < 2) {
      setBxResults([]);
      setBxSearching(false);
      return;
    }

    setBxSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `${API_URL}?action=search_bitrix&q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const json = await res.json();
          setBxResults(json.users || []);
        }
      } catch (e) {
        if ((e as { name?: string })?.name !== 'AbortError') {
          toast({ title: 'Ошибка поиска', variant: 'destructive' });
        }
      } finally {
        setBxSearching(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [bxQuery, addModalOpen]);

  const handleSaveException = async () => {
    if (!selectedBx) return;
    setSavingException(true);
    try {
      const res = await apiFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'add_exception',
          bitrix_user_id: selectedBx.id,
          full_name: selectedBx.name,
          email: selectedBx.email,
          position: selectedBx.position,
          reason,
        }),
      });
      if (res.ok) {
        toast({ title: 'Добавлен в исключения' });
        setAddModalOpen(false);
        setBxQuery('');
        setBxResults([]);
        setSelectedBx(null);
        setReason('');
        loadExceptions();
        loadData(days);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Ошибка', variant: 'destructive' });
      }
    } finally {
      setSavingException(false);
    }
  };

  const filtered = data?.users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.position || '').toLowerCase().includes(q);
  }) || [];

  const filteredExceptions = exceptions.filter(e => {
    if (!excSearch) return true;
    const q = excSearch.toLowerCase();
    return e.full_name.toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q) || (e.position || '').toLowerCase().includes(q);
  });

  return (
    <PageLayout>
      <BitrixPageHeader
        tab={tab}
        data={data}
        visibleInactiveCount={visibleInactiveCount}
        neverLoggedCount={neverLoggedCount}
        longInactiveCount={longInactiveCount}
        deactivating={deactivating}
        isAdmin={isAdmin}
        onConfirmDeactivate={setConfirmMode}
        onOpenAddException={() => setAddModalOpen(true)}
      />

      <DeactivateConfirmDialog
        confirmMode={confirmMode}
        deactivating={deactivating}
        getConfirmCount={getConfirmCount}
        onOpenChange={(open) => { if (!open) setConfirmMode(null); }}
        onDeactivate={handleDeactivate}
      />

      <RemoveExceptionDialog
        removeTarget={removeTarget}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        onConfirmRemove={handleRemoveException}
      />

      <AddExceptionDialog
        open={addModalOpen}
        onOpenChange={(open) => {
          setAddModalOpen(open);
          if (!open) {
            setBxQuery('');
            setBxResults([]);
            setSelectedBx(null);
            setReason('');
          }
        }}
        bxQuery={bxQuery}
        setBxQuery={setBxQuery}
        bxResults={bxResults}
        bxSearching={bxSearching}
        selectedBx={selectedBx}
        setSelectedBx={setSelectedBx}
        reason={reason}
        setReason={setReason}
        savingException={savingException}
        onSave={handleSaveException}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'inactive' | 'exceptions' | 'reports')} className="mb-4">
        <TabsList>
          <TabsTrigger value="inactive" className="gap-2">
            <Icon name="UserX" size={14} />
            Неактивные {data ? `(${data.inactive_count})` : ''}
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="gap-2">
            <Icon name="ShieldCheck" size={14} />
            Исключения ({exceptions.length})
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <Icon name="FileText" size={14} />
            Отчёты ({reports.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inactive">
          <InactiveUsersTab
            data={data}
            loading={loading}
            error={error}
            days={days}
            search={search}
            filtered={filtered}
            exceptionsCount={exceptions.length}
            isAdmin={isAdmin}
            onDaysChange={setDays}
            onSearchChange={setSearch}
            onSearch={handleSearch}
            onAddToExceptions={handleAddToExceptions}
          />
        </TabsContent>

        <TabsContent value="exceptions">
          <ExceptionsTab
            exceptionsLoading={exceptionsLoading}
            filteredExceptions={filteredExceptions}
            excSearch={excSearch}
            isAdmin={isAdmin}
            onExcSearchChange={setExcSearch}
            onAddModalOpen={() => setAddModalOpen(true)}
            onRemoveTarget={setRemoveTarget}
          />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab
            reportsLoading={reportsLoading}
            reports={reports}
            onOpenReport={openReportById}
          />
        </TabsContent>
      </Tabs>

      <BlockReportModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        report={activeReport}
      />

    </PageLayout>
  );
};

export default BitrixInactiveUsers;
