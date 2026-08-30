import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FN } from '@/config/backend';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import DepartmentPanel from '@/components/org-chart/DepartmentPanel';
import EditDepartmentDialog from '@/components/org-chart/EditDepartmentDialog';
import EditCompanyDialog from '@/components/org-chart/EditCompanyDialog';
import {
  Company,
  CompanyNode,
  Department,
  DepartmentNode,
  DepartmentUser,
  OrgChartTreeData,
} from '@/components/org-chart/types';
import OrgChartHeader from './org-chart/OrgChartHeader';
import OrgChartContent from './org-chart/OrgChartContent';
import OrgChartDragOverlay from './org-chart/OrgChartDragOverlay';

const API_URL = FN.DEPARTMENTS;

const getStoredAuthToken = (): string => {
  const rememberMe = localStorage.getItem('remember_me') === 'true';
  const t = rememberMe
    ? localStorage.getItem('auth_token')
    : sessionStorage.getItem('auth_token');
  return (
    t ||
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    ''
  );
};

const OrgChart = () => {
  const { user, token, loading: authLoading, hasPermission } = useAuth();
  const { toast } = useToast();
  const isAdmin =
    !!user?.roles?.some(
      (r) => r.name === 'Администратор' || r.name === 'Admin' || r.system_role === 'admin',
    ) || hasPermission('departments', 'write');

  const getToken = useCallback(() => token || getStoredAuthToken(), [token]);
  const authHeaders = useCallback(
    (json = false) => {
      const h: Record<string, string> = { 'X-Auth-Token': getToken() };
      if (json) h['Content-Type'] = 'application/json';
      return h;
    },
    [getToken],
  );

  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [panelData, setPanelData] = useState<{
    department: Department;
    head: DepartmentUser | null;
    members: DepartmentUser[];
  } | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<DepartmentUser[]>([]);
  const [activeDragUser, setActiveDragUser] = useState<DepartmentUser | null>(null);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [creatingUnder, setCreatingUnder] = useState<
    { parentId: number | null; companyId: number | null } | null
  >(null);
  const [editCompany, setEditCompany] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const loadTree = useCallback(async () => {
    if (authLoading || !getToken()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?endpoint=orgchart-tree`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data: OrgChartTreeData = await res.json();
        setCompanies(data.companies || []);
        setDepartments(data.departments || []);
        const all = new Set<string>();
        (data.companies || []).forEach((c) => all.add(`c-${c.id}`));
        all.add('none');
        setExpandedCompanies(all);
      } else {
        toast({ title: 'Не удалось загрузить структуру', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [authLoading, authHeaders, getToken, toast]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const loadDeptUsers = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`${API_URL}?endpoint=department-users&id=${id}`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setPanelData(data);
        }
      } catch {
        /* ignore */
      }
    },
    [authHeaders],
  );

  useEffect(() => {
    if (selectedDept) loadDeptUsers(selectedDept);
    else setPanelData(null);
  }, [selectedDept, loadDeptUsers]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `${API_URL}?endpoint=search-users&q=${encodeURIComponent(search)}`,
        { headers: authHeaders() },
      );
      if (res.ok) setSearchResults(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [search, authHeaders]);

  const expandAncestors = useCallback(
    (deptId: number) => {
      const map = new Map<number, Department>();
      departments.forEach((d) => map.set(d.id, d));
      const target = map.get(deptId);
      const ancestors = new Set<number>();
      let cur = target;
      while (cur && cur.parent_id) {
        ancestors.add(cur.parent_id);
        cur = map.get(cur.parent_id);
      }
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        ancestors.forEach((id) => next.add(id));
        return next;
      });
      if (target) {
        setExpandedCompanies((prev) => {
          const next = new Set(prev);
          next.add(target.company_id === null ? 'none' : `c-${target.company_id}`);
          return next;
        });
      }
    },
    [departments],
  );

  const findMe = async () => {
    const res = await fetch(`${API_URL}?endpoint=me-department`, {
      headers: authHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.department_id) {
      setSelectedDept(data.department_id);
      expandAncestors(data.department_id);
      setTimeout(() => {
        const el = document.querySelector(`[data-dept-id="${data.department_id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }, 200);
    } else {
      toast({ title: 'Вы не привязаны к отделу' });
    }
  };

  const companyNodes = useMemo<CompanyNode[]>(() => {
    const deptMap = new Map<number, DepartmentNode>();
    departments.forEach((d) => deptMap.set(d.id, { ...d, children: [] }));
    deptMap.forEach((node) => {
      if (node.parent_id && deptMap.has(node.parent_id)) {
        deptMap.get(node.parent_id)!.children.push(node);
      }
    });

    const rootsByCompany = new Map<number | 'none', DepartmentNode[]>();
    deptMap.forEach((node) => {
      if (!node.parent_id) {
        const key: number | 'none' = node.company_id == null ? 'none' : node.company_id;
        if (!rootsByCompany.has(key)) rootsByCompany.set(key, []);
        rootsByCompany.get(key)!.push(node);
      }
    });

    const result: CompanyNode[] = companies.map((c) => ({
      kind: 'company',
      id: c.id,
      name: c.name,
      members_count: c.members_count,
      children: rootsByCompany.get(c.id) || [],
    }));

    const orphanRoots = rootsByCompany.get('none') || [];
    if (orphanRoots.length > 0) {
      result.push({
        kind: 'company',
        id: null,
        name: 'Без компании',
        members_count: 0,
        children: orphanRoots,
      });
    }

    return result;
  }, [companies, departments]);

  const handleDragStart = (e: DragStartEvent) => {
    const u = e.active.data.current?.user as DepartmentUser | undefined;
    if (u) setActiveDragUser(u);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveDragUser(null);
    if (!isAdmin) {
      if (e.active.data.current?.user) {
        toast({ title: 'Недостаточно прав', variant: 'destructive' });
      }
      return;
    }
    const u = e.active.data.current?.user as DepartmentUser | undefined;
    if (!u) return;
    const overData = e.over?.data.current as
      | { deptId?: number; companyId?: number | null; kind?: string }
      | undefined;
    if (!overData) return;
    if (overData.kind !== 'dept' || !overData.deptId) return;
    if (u.department_id === overData.deptId) return;

    try {
      const res = await fetch(`${API_URL}?endpoint=move-user`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ user_id: u.id, department_id: overData.deptId }),
      });
      if (res.ok) {
        toast({ title: `${u.full_name} перемещён` });
        await loadTree();
        if (selectedDept) await loadDeptUsers(selectedDept);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Не удалось переместить', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    }
  };

  const handleCreateDept = async (
    name: string,
    parentId: number | null,
    headUserId: number | null,
  ) => {
    const companyId = creatingUnder?.companyId ?? null;
    const res = await fetch(`${API_URL}?endpoint=create-dept`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        name,
        parent_id: parentId,
        head_user_id: headUserId,
        company_id: companyId,
      }),
    });
    if (res.ok) {
      toast({ title: 'Отдел создан' });
      await loadTree();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: err.error || 'Ошибка', variant: 'destructive' });
    }
  };

  const handleUpdateDept = async (
    id: number,
    name: string,
    headUserId: number | null,
  ) => {
    const res = await fetch(`${API_URL}?endpoint=update-dept&id=${id}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ name, head_user_id: headUserId }),
    });
    if (res.ok) {
      toast({ title: 'Отдел обновлён' });
      await loadTree();
      if (selectedDept === id) await loadDeptUsers(id);
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: err.error || 'Ошибка', variant: 'destructive' });
    }
  };

  const handleDeleteDept = async (id: number) => {
    if (!window.confirm('Удалить отдел? Действие нельзя отменить.')) return;
    const res = await fetch(`${API_URL}?endpoint=delete-dept&id=${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      toast({ title: 'Отдел удалён' });
      if (selectedDept === id) setSelectedDept(null);
      await loadTree();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: err.error || 'Ошибка', variant: 'destructive' });
    }
  };

  const handleCreateCompany = async (name: string) => {
    const res = await fetch(`${API_URL}?endpoint=create-company`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      toast({ title: 'Компания создана' });
      await loadTree();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: err.error || 'Ошибка', variant: 'destructive' });
    }
  };

  const handleUpdateCompany = async (id: number, name: string) => {
    const res = await fetch(`${API_URL}?endpoint=update-company&id=${id}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      toast({ title: 'Компания обновлена' });
      await loadTree();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: err.error || 'Ошибка', variant: 'destructive' });
    }
  };

  const handleDeleteCompany = async (id: number) => {
    if (!window.confirm('Удалить компанию? Действие нельзя отменить.')) return;
    const res = await fetch(`${API_URL}?endpoint=delete-company&id=${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      toast({ title: 'Компания удалена' });
      await loadTree();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: err.error || 'Ошибка', variant: 'destructive' });
    }
  };

  return (
    <PageLayout>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-col h-[calc(100vh-7rem)] gap-4">
          <OrgChartHeader
            companiesCount={companies.length}
            departmentsCount={departments.length}
            search={search}
            setSearch={setSearch}
            searchResults={searchResults}
            setSearchResults={setSearchResults}
            setSelectedDept={setSelectedDept}
            expandAncestors={expandAncestors}
            findMe={findMe}
            isAdmin={isAdmin}
            setCreatingCompany={setCreatingCompany}
          />

          <div className="flex flex-1 gap-4 min-h-0">
            <OrgChartContent
              scrollContainerRef={scrollContainerRef}
              loading={loading}
              companyNodes={companyNodes}
              selectedDept={selectedDept}
              expandedNodes={expandedNodes}
              expandedCompanies={expandedCompanies}
              setExpandedNodes={setExpandedNodes}
              setExpandedCompanies={setExpandedCompanies}
              setSelectedDept={setSelectedDept}
              isAdmin={isAdmin}
              setEditDept={setEditDept}
              setCreatingUnder={setCreatingUnder}
              setEditCompany={setEditCompany}
              setCreatingCompany={setCreatingCompany}
              departments={departments}
              handleDeleteDept={handleDeleteDept}
              handleDeleteCompany={handleDeleteCompany}
            />

            {selectedDept && panelData && (
              <DepartmentPanel
                data={panelData}
                isAdmin={isAdmin}
                onClose={() => setSelectedDept(null)}
                onEditDept={() => setEditDept(panelData.department)}
              />
            )}
          </div>
        </div>

        <OrgChartDragOverlay activeDragUser={activeDragUser} />
      </DndContext>

      <EditDepartmentDialog
        open={editDept !== null || creatingUnder !== null}
        mode={editDept ? 'edit' : 'create'}
        department={editDept}
        parentId={editDept ? editDept.parent_id : creatingUnder?.parentId ?? null}
        departments={departments}
        authHeaders={authHeaders}
        apiUrl={API_URL}
        onClose={() => {
          setEditDept(null);
          setCreatingUnder(null);
        }}
        onSave={async (name, headUserId) => {
          if (editDept) {
            await handleUpdateDept(editDept.id, name, headUserId);
          } else {
            await handleCreateDept(name, creatingUnder?.parentId ?? null, headUserId);
          }
          setEditDept(null);
          setCreatingUnder(null);
        }}
      />

      <EditCompanyDialog
        open={editCompany !== null || creatingCompany}
        mode={editCompany ? 'edit' : 'create'}
        initialName={editCompany?.name}
        onClose={() => {
          setEditCompany(null);
          setCreatingCompany(false);
        }}
        onSave={async (name) => {
          if (editCompany) {
            await handleUpdateCompany(editCompany.id, name);
          } else {
            await handleCreateCompany(name);
          }
          setEditCompany(null);
          setCreatingCompany(false);
        }}
      />
    </PageLayout>
  );
};

export default OrgChart;
