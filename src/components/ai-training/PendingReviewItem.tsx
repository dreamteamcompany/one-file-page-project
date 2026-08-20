import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

export interface PendingReview {
  id: number;
  description: string;
  ticket_service_id: number;
  service_ids: number[];
  ticket_service_name: string;
  service_names: string[];
  confidence: number;
  status: string;
  created_at: string;
  clarifying_questions?: string[] | null;
  source_ticket_id?: number | null;
}

export const getConfidenceBadge = (confidence: number) => {
  if (confidence > 70) {
    return (
      <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">
        {confidence}%
      </Badge>
    );
  }
  if (confidence >= 40) {
    return (
      <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300 bg-yellow-50">
        {confidence}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-red-600 border-red-300 bg-red-50">
      {confidence}%
    </Badge>
  );
};

interface PendingReviewItemProps {
  rv: PendingReview;
  loading: boolean;
  recheckingId: number | null;
  bulkRecheck: { scope: 'pending' | 'all'; done: number } | null;
  recheckOne: (id: number) => void;
  handleApprove: (id: number) => void;
  openCorrectDialog: (review: PendingReview) => void;
  handleReject: (id: number) => void;
}

const PendingReviewItem = ({
  rv,
  loading,
  recheckingId,
  bulkRecheck,
  recheckOne,
  handleApprove,
  openCorrectDialog,
  handleReject,
}: PendingReviewItemProps) => (
  <div className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        {rv.source_ticket_id ? (
          <button
            type="button"
            onClick={() => window.open(`/tickets/${rv.source_ticket_id}`, '_blank')}
            className="text-sm font-medium mb-1.5 line-clamp-2 text-left hover:text-primary hover:underline flex items-start gap-1 group"
            title="Открыть заявку в новой вкладке"
          >
            <span className="line-clamp-2">{rv.description}</span>
            <Icon name="ExternalLink" size={13} className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : (
          <p className="text-sm font-medium mb-1.5 line-clamp-2">{rv.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {getConfidenceBadge(rv.confidence)}
          {rv.ticket_service_name && (
            <Badge variant="secondary" className="text-xs">
              {rv.ticket_service_name}
            </Badge>
          )}
          {rv.service_names?.map((name, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {name}
            </Badge>
          ))}
        </div>
        {rv.clarifying_questions && rv.clarifying_questions.length > 0 && (
          <div className="mt-2 pl-2 border-l-2 border-primary/30">
            <p className="text-[11px] font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
              <Icon name="MessageCircleQuestion" size={12} />
              Вопросы, которые задал бы ИИ:
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              {rv.clarifying_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => recheckOne(rv.id)}
          disabled={loading || recheckingId === rv.id || !!bulkRecheck}
          title="Перепроверить (учесть определения и правила)"
          aria-label="Перепроверить"
        >
          <Icon name={recheckingId === rv.id ? 'Loader2' : 'RefreshCw'} size={14} className={recheckingId === rv.id ? 'animate-spin' : ''} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={() => handleApprove(rv.id)}
          disabled={loading}
          title="Подтвердить"
          aria-label="Подтвердить"
        >
          <Icon name="Check" size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={() => openCorrectDialog(rv)}
          disabled={loading}
          title="Исправить"
          aria-label="Исправить"
        >
          <Icon name="Pencil" size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => handleReject(rv.id)}
          disabled={loading}
          title="Отклонить"
          aria-label="Отклонить"
        >
          <Icon name="X" size={14} />
        </Button>
      </div>
    </div>
  </div>
);

export default PendingReviewItem;
