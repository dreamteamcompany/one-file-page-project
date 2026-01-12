import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Service {
  id: number;
  name: string;
  intermediate_approver_id: number;
  final_approver_id: number;
}

interface PendingApprovalsFiltersProps {
  services: Service[];
  selectedService: string;
  setSelectedService: (value: string) => void;
  amountFrom: string;
  setAmountFrom: (value: string) => void;
  amountTo: string;
  setAmountTo: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  activeFiltersCount: number;
  clearFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

const PendingApprovalsFilters = ({
  services,
  selectedService,
  setSelectedService,
  amountFrom,
  setAmountFrom,
  amountTo,
  setAmountTo,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  activeFiltersCount,
  clearFilters,
  filteredCount,
  totalCount,
}: PendingApprovalsFiltersProps) => {
  return (
    <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)] mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Icon name="SlidersHorizontal" size={20} />
            Фильтры
          </h3>
          {activeFiltersCount > 0 && (
            <Button
              onClick={clearFilters}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-primary"
            >
              <Icon name="X" size={16} className="mr-1" />
              Сбросить
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Сервис</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Все сервисы</option>
              {services.map((service) => (
                <option key={service.id} value={service.id.toString()}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Сумма от</label>
            <Input
              type="number"
              placeholder="0"
              value={amountFrom}
              onChange={(e) => setAmountFrom(e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Сумма до</label>
            <Input
              type="number"
              placeholder="∞"
              value={amountTo}
              onChange={(e) => setAmountTo(e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Дата от</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Дата до</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="flex items-end">
            <div className="text-sm text-muted-foreground">
              {filteredCount === totalCount ? (
                <>Показано: <span className="font-semibold text-white">{totalCount}</span> платежей</>
              ) : (
                <>Найдено: <span className="font-semibold text-primary">{filteredCount}</span> из {totalCount}</>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PendingApprovalsFilters;
