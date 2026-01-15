import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Service {
  id: number;
  name: string;
  description: string;
  category_id?: number;
  category_name?: string;
}

interface TicketFormStep3Props {
  filteredServices: Service[];
  selectedServices: number[];
  onToggleService: (serviceId: number) => void;
  onNext: () => void;
  onBack: () => void;
}

const TicketFormStep3 = ({
  filteredServices,
  selectedServices,
  onToggleService,
  onNext,
  onBack,
}: TicketFormStep3Props) => {
  return (
    <div className="space-y-4 mt-4">
        <div className="space-y-3">
          <Label>Выберите сервисы (минимум 1) *</Label>
          <p className="text-sm text-muted-foreground">
            Выберите один или несколько сервисов для выбранной услуги
          </p>
          {filteredServices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="AlertCircle" size={48} className="mx-auto mb-2 opacity-50" />
              <p>Нет доступных сервисов для этой услуги</p>
              <Button
                type="button"
                variant="link"
                onClick={onBack}
                className="mt-2"
              >
                Выбрать другую услугу
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {filteredServices.map((service) => (
                <Card
                  key={service.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedServices.includes(service.id)
                      ? 'ring-2 ring-primary bg-accent/50'
                      : 'hover:bg-accent/30'
                  }`}
                  onClick={() => onToggleService(service.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-start justify-between gap-2">
                      {service.name}
                      {selectedServices.includes(service.id) && (
                        <Icon name="CheckCircle2" size={20} className="text-primary flex-shrink-0" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {service.description && (
                    <CardContent className="pt-0">
                      <CardDescription className="text-sm line-clamp-2">
                        {service.description}
                      </CardDescription>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {selectedServices.length > 0 && (
          <div className="p-3 bg-accent/30 rounded-lg">
            <p className="text-sm font-medium mb-2">
              Выбрано сервисов: {selectedServices.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedServices.map(id => {
                const service = filteredServices.find(s => s.id === id);
                return service ? (
                  <Badge key={id} variant="secondary">
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
    </div>
  );
};

export default TicketFormStep3;