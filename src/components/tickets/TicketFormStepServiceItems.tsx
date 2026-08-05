import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Service {
  id: number;
  name: string;
  description: string;
}

interface TicketFormStepServiceItemsProps {
  filteredServices: Service[];
  allServices: Service[];
  selectedServices: number[];
  onToggleService: (serviceId: number) => void;
  onNext: () => void;
  onBack: () => void;
}

const PAGE_SIZE = 12;

const TicketFormStepServiceItems = ({
  filteredServices,
  allServices,
  selectedServices,
  onToggleService,
  onNext,
  onBack,
}: TicketFormStepServiceItemsProps) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredServices;
    return filteredServices.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q),
    );
  }, [filteredServices, search]);

  const totalPages = Math.max(1, Math.ceil(searched.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = searched.slice(start, start + PAGE_SIZE);
  const rangeFrom = searched.length === 0 ? 0 : start + 1;
  const rangeTo = Math.min(start + PAGE_SIZE, searched.length);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="space-y-5 mt-2">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Icon
            name="Search"
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Поиск по сервисам..."
            className="h-8 rounded-xl pl-10 text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-xl gap-2 px-4 text-muted-foreground"
        >
          <Icon name="SlidersHorizontal" size={16} />
          Фильтры
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Выберите сервис</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {pageItems.map((service) => {
            const isSelected = selectedServices.includes(service.id);
            return (
              <button
                type="button"
                key={service.id}
                onClick={() => onToggleService(service.id)}
                className={`group relative flex items-center gap-3 text-left rounded-2xl border px-4 py-[1.38rem] pr-10 lg:pr-4 transition-all duration-150 ${
                  isSelected
                    ? 'border-primary border-2 bg-primary/[0.04] shadow-sm'
                    : 'border-border bg-card hover:border-primary/40 hover:shadow-md'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors ${
                    isSelected ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                  }`}
                >
                  <Icon name="Building2" size={20} />
                </div>
                <div className="min-w-0 flex-1 lg:pr-5">
                  <p className="text-sm font-semibold leading-tight text-foreground">
                    {service.name}
                  </p>
                  {service.description && (
                    <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2">
                      {service.description}
                    </p>
                  )}
                </div>
                <div
                  className={`absolute right-3 top-1/2 -translate-y-1/2 lg:right-3 lg:top-3 lg:translate-y-0 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30 bg-transparent'
                  }`}
                >
                  {isSelected && (
                    <Icon name="Check" size={12} className="text-primary-foreground" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Показано {rangeFrom}–{rangeTo} из {searched.length} сервисов
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Предыдущая страница"
            aria-label="Предыдущая страница"
          >
            <Icon name="ChevronLeft" size={16} />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              type="button"
              variant={p === currentPage ? 'default' : 'outline'}
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => setPage(p)}
              title={`Страница ${p}`}
              aria-label={`Страница ${p}`}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            title="Следующая страница"
            aria-label="Следующая страница"
          >
            <Icon name="ChevronRight" size={16} />
          </Button>
        </div>
      </div>

      {selectedServices.length > 0 && (
        <div className="p-3 bg-accent/30 rounded-lg">
          <div className="flex flex-wrap gap-2">
            {selectedServices.map(id => {
              const service = allServices.find(s => s.id === id);
              return service ? (
                <Badge key={id} variant="secondary" className="text-xs">
                  {service.name}
                </Badge>
              ) : null;
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="gap-2"
        >
          <Icon name="ArrowLeft" size={18} />
          Назад
        </Button>
        <Button
          type="button"
          className="flex-1 gap-2"
          disabled={selectedServices.length === 0}
          onClick={onNext}
        >
          Далее
          <Icon name="ArrowRight" size={18} />
        </Button>
      </div>
    </div>
  );
};

export default TicketFormStepServiceItems;