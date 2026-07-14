import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface Service {
  id: number;
  name: string;
  description: string;
  category_id?: number;
  category_name?: string;
  service_ids?: number[];
}

interface ClassificationResult {
  ticket_service_id: number;
  service_ids: number[];
  ticket_service_name: string;
  service_names: string[];
  confidence: number;
  clarifying_questions?: string[];
}

interface TicketFormStepClassifyProps {
  classification: ClassificationResult;
  ticketServices: Service[];
  services: Service[];
  selectedTicketServiceId: string;
  selectedServices: number[];
  onChangeTicketService: (serviceId: number) => void;
  onToggleService: (serviceId: number) => void;
  onNext: () => void;
  onBack: () => void;
  filteredServices: Service[];
  classificationMode?: 'ai' | 'manual';
  clarifyingAnswers?: Record<number, string>;
  onChangeClarifyingAnswer?: (index: number, value: string) => void;
}

const TicketFormStepClassify = ({
  classification,
  ticketServices,
  services,
  selectedTicketServiceId,
  selectedServices,
  onChangeTicketService,
  onToggleService,
  onNext,
  onBack,
  filteredServices,
  classificationMode = 'ai',
  clarifyingAnswers = {},
  onChangeClarifyingAnswer,
}: TicketFormStepClassifyProps) => {
  const [manualMode, setManualMode] = useState(classificationMode === 'manual' || classification.confidence === 0);

  const questions = classification.clarifying_questions || [];
  const allQuestionsAnswered = questions.every(
    (_, idx) => (clarifyingAnswers[idx] || '').trim().length > 0,
  );

  const confidenceColor = classification.confidence >= 70
    ? 'text-green-600 bg-green-50 border-green-200'
    : classification.confidence >= 40
    ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : 'text-red-600 bg-red-50 border-red-200';

  const confidenceText = classification.confidence >= 70
    ? 'Высокая уверенность'
    : classification.confidence >= 40
    ? 'Средняя уверенность'
    : 'Низкая уверенность';

  return (
    <div className="space-y-4 mt-4">
      {classificationMode === 'ai' && classification.confidence > 0 && (
        <div className={`p-4 rounded-lg border ${confidenceColor}`}>
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Sparkles" size={18} />
            <span className="font-medium text-sm">ИИ определил категорию ({confidenceText})</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">Услуга:</span> {classification.ticket_service_name}
            </p>
            <p className="text-sm">
              <span className="font-medium">Сервис:</span> {classification.service_names.join(', ')}
            </p>
          </div>
        </div>
      )}

      {classificationMode === 'ai' && classification.confidence === 0 && (
        <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="AlertTriangle" size={18} />
            <span className="font-medium text-sm">Не удалось определить категорию автоматически</span>
          </div>
          <p className="text-sm">Выберите услугу и сервис вручную</p>
        </div>
      )}

      {classificationMode === 'manual' && (
        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
          <div className="flex items-center gap-2">
            <Icon name="ListChecks" size={18} />
            <span className="font-medium text-sm">Выберите услугу и сервис</span>
          </div>
        </div>
      )}

      {!manualMode ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Если определение верное — нажмите «Далее». Или измените вручную:
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManualMode(true)}
            className="gap-2"
          >
            <Icon name="Pencil" size={14} />
            Изменить вручную
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Услуга *</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-2">
              {ticketServices.map((service) => (
                <Card
                  key={service.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedTicketServiceId === service.id.toString()
                      ? 'border-primary border-2 shadow-lg shadow-primary/20 bg-primary/5'
                      : 'hover:border-primary/50 hover:shadow-md'
                  }`}
                  onClick={() => onChangeTicketService(service.id)}
                >
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-start justify-between gap-2">
                      <span className={selectedTicketServiceId === service.id.toString() ? 'text-primary font-semibold' : ''}>
                        {service.name}
                      </span>
                      {selectedTicketServiceId === service.id.toString() && (
                        <div className="rounded-full bg-primary p-0.5">
                          <Icon name="Check" size={12} className="text-primary-foreground flex-shrink-0" />
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          {filteredServices.length > 0 && (
            <div className="space-y-3">
              <Label>Сервис *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2">
                {filteredServices.map((service) => (
                  <Card
                    key={service.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedServices.includes(service.id)
                        ? 'border-primary border-2 shadow-lg shadow-primary/20 bg-primary/5'
                        : 'hover:border-primary/50 hover:shadow-md'
                    }`}
                    onClick={() => onToggleService(service.id)}
                  >
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-start justify-between gap-2">
                        <span className={selectedServices.includes(service.id) ? 'text-primary font-semibold' : ''}>
                          {service.name}
                        </span>
                        {selectedServices.includes(service.id) && (
                          <div className="rounded-full bg-primary p-0.5">
                            <Icon name="Check" size={12} className="text-primary-foreground flex-shrink-0" />
                          </div>
                        )}
                      </CardTitle>
                    </CardHeader>
                    {service.description && (
                      <CardContent className="pt-0 px-4 pb-3">
                        <CardDescription className="text-xs line-clamp-1">
                          {service.description}
                        </CardDescription>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedServices.length > 0 && (
        <div className="p-3 bg-accent/30 rounded-lg">
          <div className="flex flex-wrap gap-2">
            {selectedServices.map(id => {
              const service = services.find(s => s.id === id);
              return service ? (
                <Badge key={id} variant="secondary" className="text-xs">
                  {service.name}
                </Badge>
              ) : null;
            })}
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
          <div className="flex items-center gap-2">
            <Icon name="MessageCircleQuestion" size={18} className="text-primary" />
            <span className="font-medium text-sm">Уточните детали — это ускорит решение</span>
          </div>
          {questions.map((q, idx) => (
            <div key={idx} className="space-y-1.5">
              <Label className="text-sm">
                {q} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={clarifyingAnswers[idx] || ''}
                onChange={(e) => onChangeClarifyingAnswer?.(idx, e.target.value)}
                placeholder="Ваш ответ"
                rows={2}
              />
            </div>
          ))}
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
          disabled={!selectedTicketServiceId || selectedServices.length === 0 || !allQuestionsAnswered}
          onClick={onNext}
        >
          Далее
          <Icon name="ArrowRight" size={18} />
        </Button>
      </div>
    </div>
  );
};

export default TicketFormStepClassify;