import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CustomerDepartment {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

const CustomerDepartments = () => {
  const [departments, setDepartments] = useState<CustomerDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<CustomerDepartment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<CustomerDepartment | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

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

  const loadDepartments = () => {
    apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=customer_departments')
      .then(res => res.json())
      .then((data) => {
        setDepartments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load departments:', err);
        setDepartments([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=customer_departments';
      const method = editingDepartment ? 'PUT' : 'POST';
      const body = editingDepartment 
        ? { id: editingDepartment.id, ...formData }
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
        setEditingDepartment(null);
        setFormData({ name: '', description: '' });
        loadDepartments();
      }
    } catch (error) {
      console.error('Failed to save department:', error);
    }
  };

  const handleEdit = (department: CustomerDepartment) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (department: CustomerDepartment) => {
    setDepartmentToDelete(department);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!departmentToDelete) return;

    try {
      const response = await apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=customer_departments', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: departmentToDelete.id }),
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setDepartmentToDelete(null);
        loadDepartments();
      }
    } catch (error) {
      console.error('Failed to delete department:', error);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingDepartment(null);
    setFormData({ name: '', description: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1729] to-[#1b254b]">
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

      <div className="lg:ml-[250px] p-4 md:p-8 overflow-x-hidden max-w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden text-white p-2 hover:bg-white/10 rounded-lg"
            >
              <Icon name="Menu" size={24} />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Отделы-заказчики</h1>
              <p className="text-muted-foreground mt-1">Управление отделами-заказчиками</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Icon name="Plus" size={18} />
            Добавить отдел
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingDepartment ? 'Редактировать отдел' : 'Новый отдел-заказчик'}
                </DialogTitle>
                <DialogDescription>
                  {editingDepartment 
                    ? 'Измените информацию об отделе' 
                    : 'Создайте новый отдел-заказчик'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название отдела</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="IT отдел"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Описание отдела"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Отмена
                  </Button>
                  <Button type="submit">
                    {editingDepartment ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader2" size={32} className="text-primary animate-spin" />
          </div>
        ) : departments.length === 0 ? (
          <Card className="border-white/10 bg-card/50 backdrop-blur-xl">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Icon name="Building" size={48} className="text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Нет отделов-заказчиков
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((department) => (
              <Card key={department.id} className="border-white/10 bg-card/50 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Icon name="Building" size={20} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{department.name}</h3>
                        {department.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {department.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(department)}
                      className="flex-1"
                    >
                      <Icon name="Edit" size={16} />
                      Изменить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(department)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Icon name="Trash2" size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отдел-заказчик?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить отдел "{departmentToDelete?.name}"? 
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomerDepartments;