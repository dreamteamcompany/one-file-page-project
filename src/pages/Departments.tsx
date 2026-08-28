import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/utils/api';
import { Department, Company, Position, DepartmentPosition } from '@/types';
import DepartmentTree from '@/components/departments/DepartmentTree';
import PageLayout from '@/components/layout/PageLayout';
import AppHeader from '@/components/layout/AppHeader';
import DepartmentsHeader from '@/components/departments/DepartmentsHeader';
import DepartmentsFilters from '@/components/departments/DepartmentsFilters';
import DepartmentFormDialog from '@/components/departments/DepartmentFormDialog';
import DeleteDepartmentDialog from '@/components/departments/DeleteDepartmentDialog';
import { FN } from '@/config/backend';

interface FormData {
  company_id: string;
  parent_id: string;
  name: string;
  code: string;
  description: string;
  position_ids: number[];
}

const emptyForm: FormData = {
  company_id: '',
  parent_id: '',
  name: '',
  code: '',
  description: '',
  position_ids: [],
};

const Departments = () => {
  const { hasPermission, hasSystemRole } = useAuth();
  const isAdmin = hasSystemRole('admin');
  const [menuOpen, setMenuOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [departmentPositions, setDepartmentPositions] = useState<DepartmentPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [syncing, setSyncing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[loadData] Starting data fetch...');
      const [depsRes, compsRes, posRes, depPosRes] = await Promise.all([
        apiFetch('/departments'),
        apiFetch('/companies'),
        apiFetch('/positions'),
        apiFetch('/department-positions'),
      ]);
      const [depsData, compsData, posData, depPosData] = await Promise.all([
        depsRes.json(),
        compsRes.json(),
        posRes.json(),
        depPosRes.json(),
      ]);
      console.log('[loadData] Departments received:', depsData?.length || 0, depsData);
      console.log('[loadData] Companies received:', compsData?.length || 0, compsData);
      console.log('[loadData] Positions received:', posData?.length || 0);
      console.log('[loadData] Dept-Positions received:', depPosData?.length || 0);
      setDepartments(Array.isArray(depsData) ? depsData : []);
      setCompanies(Array.isArray(compsData) ? compsData : []);
      setPositions(Array.isArray(posData) ? posData : []);
      setDepartmentPositions(Array.isArray(depPosData) ? depPosData : []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        company_id: parseInt(formData.company_id),
        parent_id: formData.parent_id ? parseInt(formData.parent_id) : null,
        name: formData.name,
        code: formData.code || null,
        description: formData.description || null,
        position_ids: formData.position_ids,
      };

      if (editingDepartment) {
        await apiFetch(`/departments/${editingDepartment.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/departments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      setEditingDepartment(null);
      setParentIdForNew(null);
      setFormData(emptyForm);
      loadData();
    } catch (error) {
      console.error('Failed to save department:', error);
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    const depPos = Array.isArray(departmentPositions)
      ? departmentPositions
          .filter((dp) => dp.department_id === department.id)
          .map((dp) => dp.position_id)
      : [];
    setFormData({
      company_id: department.company_id.toString(),
      parent_id: department.parent_id?.toString() || '',
      name: department.name,
      code: department.code || '',
      description: department.description || '',
      position_ids: depPos,
    });
    setDialogOpen(true);
  };

  const handleAddChild = (parentId: number) => {
    const parent = departments.find((d) => d.id === parentId);
    setParentIdForNew(parentId);
    setFormData({
      company_id: parent?.company_id.toString() || '',
      parent_id: parentId.toString(),
      name: '',
      code: '',
      description: '',
      position_ids: [],
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    const dept = departments.find((d) => d.id === id) || null;
    setDepartmentToDelete(dept);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async (mode: 'cascade' | 'reparent') => {
    if (!departmentToDelete) return;
    try {
      const response = await apiFetch(
        `/departments/${departmentToDelete.id}?mode=${mode}`,
        { method: 'DELETE' },
      );
      if (response.ok) {
        setDeleteDialogOpen(false);
        setDepartmentToDelete(null);
        loadData();
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data?.error === 'department_has_users') {
        alert(data.message || 'В подразделении есть сотрудники. Сначала перенесите их в другой отдел.');
      } else {
        alert(data?.message || data?.error || 'Не удалось удалить подразделение');
      }
    } catch (error) {
      console.error('Failed to delete department:', error);
      alert('Ошибка соединения при удалении подразделения');
    }
  };

  const handleToggleHide = async (department: Department) => {
    const next = !department.is_hidden;
    // Оптимистичное обновление
    setDepartments((prev) =>
      prev.map((d) => (d.id === department.id ? { ...d, is_hidden: next } : d)),
    );
    try {
      const response = await apiFetch(`/departments/${department.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_hidden: next }),
      });
      if (!response.ok) {
        // Откат при ошибке
        setDepartments((prev) =>
          prev.map((d) => (d.id === department.id ? { ...d, is_hidden: !next } : d)),
        );
        alert('Не удалось изменить видимость подразделения');
      }
    } catch (error) {
      console.error('Failed to toggle hide:', error);
      setDepartments((prev) =>
        prev.map((d) => (d.id === department.id ? { ...d, is_hidden: !next } : d)),
      );
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Деактивировать подразделение и все дочерние?')) return;
    try {
      const response = await apiFetch(`/departments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      });
      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to deactivate department:', error);
    }
  };

  const handleSyncFromBitrix = async () => {
    let companyId = selectedCompany;

    if (!companyId) {
      if (companies.length === 0) {
        alert('Сначала создайте компанию');
        return;
      }
      if (companies.length === 1) {
        companyId = companies[0].id.toString();
      } else {
        alert('Выберите компанию из списка выше для синхронизации');
        return;
      }
    }

    if (!confirm('Синхронизировать подразделения из Bitrix24? Это может занять несколько минут для больших баз.')) {
      return;
    }

    setSyncing(true);

    try {
      console.log('Starting Bitrix24 sync for company:', companyId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout, aborting...');
        controller.abort();
      }, 300000);

      try {
        const response = await apiFetch(FN.BITRIX_SYNC_DEPARTMENTS, {
          method: 'POST',
          body: JSON.stringify({ company_id: parseInt(companyId) }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Network error' }));
          console.error('Sync error response:', error);
          throw new Error(error.error || 'Ошибка синхронизации');
        }

        const result = await response.json();
        console.log('Sync result:', result);

        const stats = result.stats || {};
        const parts: string[] = [];
        if (stats.created) parts.push(`создано: ${stats.created}`);
        if (stats.updated) parts.push(`обновлено: ${stats.updated}`);
        if (stats.archived) parts.push(`архивировано: ${stats.archived}`);
        if (stats.restored) parts.push(`восстановлено из архива: ${stats.restored}`);
        if (stats.orphaned) parts.push(`без родителя: ${stats.orphaned}`);
        if (stats.cycles) parts.push(`циклов пропущено: ${stats.cycles}`);
        const summary = parts.length > 0 ? parts.join(', ') : 'без изменений';
        const total = result.total_in_bitrix ?? result.synced_count ?? 0;

        let posSummary = 'пропущено';
        let posError = '';
        let posTotalUsers = 0;
        try {
          const posController = new AbortController();
          const posTimeoutId = setTimeout(() => posController.abort(), 300000);
          const posResp = await apiFetch(FN.BITRIX_SYNC_POSITIONS, {
            method: 'POST',
            body: JSON.stringify({ company_id: parseInt(companyId) }),
            signal: posController.signal,
          });
          clearTimeout(posTimeoutId);
          if (!posResp.ok) {
            const err = await posResp.json().catch(() => ({ error: 'Network error' }));
            throw new Error(err.error || 'Ошибка синхронизации должностей');
          }
          const posResult = await posResp.json();
          const ps = posResult.stats || {};
          posTotalUsers = posResult.total_users_in_bitrix || 0;
          const posParts: string[] = [];
          if (ps.positions_created) posParts.push(`создано: ${ps.positions_created}`);
          if (ps.positions_updated) posParts.push(`обновлено: ${ps.positions_updated}`);
          if (ps.department_links_created) posParts.push(`связей с отделами: ${ps.department_links_created}`);
          if (ps.users_updated) posParts.push(`сотрудников обновлено: ${ps.users_updated}`);
          posSummary = posParts.length > 0 ? posParts.join(', ') : 'без изменений';
        } catch (pe: unknown) {
          posError = pe instanceof Error ? pe.message : 'Неизвестная ошибка';
          console.error('Positions sync error:', pe);
        }

        let headsSummary = 'пропущено';
        let headsError = '';
        try {
          const headsController = new AbortController();
          const headsTimeoutId = setTimeout(() => headsController.abort(), 300000);
          const headsResp = await apiFetch(FN.BITRIX_SYNC_HEADS, {
            method: 'POST',
            body: JSON.stringify({ company_id: parseInt(companyId) }),
            signal: headsController.signal,
          });
          clearTimeout(headsTimeoutId);
          if (!headsResp.ok) {
            const err = await headsResp.json().catch(() => ({ error: 'Network error' }));
            throw new Error(err.error || 'Ошибка синхронизации руководителей');
          }
          const headsResult = await headsResp.json();
          const hs = headsResult.stats || {};
          const headsParts: string[] = [];
          if (hs.heads_in_bitrix) headsParts.push(`руководителей в Bitrix: ${hs.heads_in_bitrix}`);
          if (hs.users_created) headsParts.push(`создано: ${hs.users_created}`);
          if (hs.users_updated) headsParts.push(`обновлено: ${hs.users_updated}`);
          if (hs.users_deactivated) headsParts.push(`деактивировано: ${hs.users_deactivated}`);
          headsSummary = headsParts.length > 0 ? headsParts.join(', ') : 'без изменений';
        } catch (he: unknown) {
          headsError = he instanceof Error ? he.message : 'Неизвестная ошибка';
          console.error('Heads sync error:', he);
        }

        alert(
          `Синхронизация завершена!\n` +
          `Отделов в Bitrix24: ${total}\n${summary}\n\n` +
          `Пользователей в Bitrix24: ${posTotalUsers}\n` +
          `Должности: ${posSummary}` +
          (posError ? `\nОшибка должностей: ${posError}` : '') +
          `\n\nРуководители: ${headsSummary}` +
          (headsError ? `\nОшибка руководителей: ${headsError}` : ''),
        );
        loadData();
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('Request aborted due to timeout');
          throw new Error('Превышен лимит ожидания. Попробуйте позже.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert(`Ошибка при синхронизации с Bitrix24: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      console.log('Sync finished, setting syncing to false');
      setSyncing(false);
    }
  };

  const filteredDepartments = departments.filter((dept) => {
    const matchesSearch =
      dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dept.code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompany =
      !selectedCompany || (dept.company_id && dept.company_id.toString() === selectedCompany);
    const passes = matchesSearch && matchesCompany;
    if (!passes && dept.id <= 10) {
      console.log('[filter]', dept.id, dept.name, 'search:', matchesSearch, 'company:', matchesCompany, 'selectedCompany:', selectedCompany, 'dept.company_id:', dept.company_id);
    }
    return passes;
  });

  const canCreate = hasPermission('departments', 'create') || isAdmin;
  const canEdit = hasPermission('departments', 'update') || isAdmin;
  const canDelete = hasPermission('departments', 'delete') || isAdmin;

  const availableParents = editingDepartment
    ? departments.filter(
        (d) =>
          d.id !== editingDepartment.id &&
          d.company_id &&
          d.company_id.toString() === formData.company_id
      )
    : departments.filter((d) => d.company_id && d.company_id.toString() === formData.company_id);

  if (loading) {
    return (
      <PageLayout menuOpen={menuOpen} setMenuOpen={setMenuOpen}>
        <AppHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout menuOpen={menuOpen} setMenuOpen={setMenuOpen}>
      <AppHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <div className="space-y-6">
        <DepartmentsHeader
          canCreate={canCreate}
          syncing={syncing}
          dialogOpen={dialogOpen}
          onDialogOpenChange={setDialogOpen}
          onSyncFromBitrix={handleSyncFromBitrix}
          onNewDepartment={() => {
            setEditingDepartment(null);
            setParentIdForNew(null);
            setFormData(emptyForm);
          }}
        />

        <DepartmentsFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCompany={selectedCompany}
          onCompanyChange={setSelectedCompany}
          companies={companies}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
        />

        <DepartmentFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingDepartment={editingDepartment}
          parentIdForNew={parentIdForNew}
          formData={formData}
          onFormDataChange={setFormData}
          companies={companies}
          availableParents={availableParents}
          positions={positions}
          onSubmit={handleSubmit}
        />

        <DepartmentTree
          departments={filteredDepartments}
          departmentPositions={departmentPositions}
          positions={positions}
          onEdit={canEdit ? handleEdit : undefined}
          onDelete={canDelete ? handleDelete : undefined}
          onDeactivate={canDelete ? handleDeactivate : undefined}
          onToggleHide={isAdmin ? handleToggleHide : undefined}
          onAddChild={canCreate ? handleAddChild : undefined}
          canEdit={canEdit}
          canDelete={canDelete}
          canCreate={canCreate}
          canHide={isAdmin}
          showArchived={showArchived}
        />

        <DeleteDepartmentDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDepartmentToDelete(null);
          }}
          department={departmentToDelete}
          hasChildren={
            !!departmentToDelete &&
            departments.some((d) => d.parent_id === departmentToDelete.id)
          }
          onConfirm={confirmDelete}
        />
      </div>
    </PageLayout>
  );
};

export default Departments;