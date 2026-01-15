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

interface TicketFormStep2Props {
  formData: {
    service_id: string;
  };
  availableTicketServices: Service[];
  onServiceSelect: (serviceId: number) => void;
  onNext: () => void;
  onBack: () => void;
}

const TicketFormStep2 = ({
  formData,
  availableTicketServices,
  onServiceSelect,
  onNext,
  onBack,
}: TicketFormStep2Props) => {
  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-3">
        <Label>Выберите услугу *</Label>
        {availableTicketServices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="Package" size={48} className="mx-auto mb-2 opacity-50" />
            <p>Нет доступных услуг</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
            {availableTicketServices.map((service) => (
              <Card
                key={service.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  formData.service_id === service.id.toString()
                    ? 'ring-2 ring-primary bg-accent/50'
                    : 'hover:bg-accent/30'
                }`}
                onClick={() => onServiceSelect(service.id)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-start justify-between gap-2">
                    {service.name}
                    {formData.service_id === service.id.toString() && (
                      <Icon name="CheckCircle2" size={20} className="text-primary flex-shrink-0" />
                    )}
                  </CardTitle>
                  {service.category_name && (
                    <Badge variant="secondary" className="w-fit text-xs">
                      {service.category_name}
                    </Badge>
                  )}
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
          onClick={onNext}
          className="flex-1 gap-2"
          disabled={!formData.service_id}
        >
          Далее
          <Icon name="ArrowRight" size={18} />
        </Button>
      </div>
    </div>
  );
};

export default TicketFormStep2;
