import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface LogEntry {
  id: number;
  file_id: number;
  line_number: number;
  timestamp: string | null;
  level: string | null;
  message: string;
  raw_line: string;
}

interface LogEntriesViewerProps {
  entries: LogEntry[];
  loading: boolean;
  total: number;
  offset: number;
  limit: number;
  onRefresh: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  formatTimestamp: (timestamp: string | null) => string;
  getLevelColor: (level: string | null) => string;
  getLevelBadgeVariant: (level: string | null) => "default" | "destructive" | "secondary" | "outline";
}

const LogEntriesViewer = ({
  entries,
  loading,
  total,
  offset,
  limit,
  onRefresh,
  onPrevPage,
  onNextPage,
  formatTimestamp,
  getLevelColor,
  getLevelBadgeVariant,
}: LogEntriesViewerProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            Логи ({total} записей)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <Icon name="RefreshCw" size={16} className="mr-2" />
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Icon name="Loader2" size={32} className="animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Логи не найдены
          </div>
        ) : (
          <>
            <div className="space-y-2 font-mono text-sm">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex flex-wrap gap-2 mb-1 text-xs text-muted-foreground">
                    <span>#{entry.line_number}</span>
                    {entry.timestamp && (
                      <span>{formatTimestamp(entry.timestamp)}</span>
                    )}
                    {entry.level && (
                      <Badge variant={getLevelBadgeVariant(entry.level)} className="text-xs">
                        {entry.level}
                      </Badge>
                    )}
                  </div>
                  <div className={getLevelColor(entry.level)}>{entry.message}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={onPrevPage}
                disabled={offset === 0}
              >
                <Icon name="ChevronLeft" size={16} className="mr-2" />
                Назад
              </Button>

              <span className="text-sm text-muted-foreground">
                {offset + 1} - {Math.min(offset + limit, total)} из {total}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={onNextPage}
                disabled={offset + limit >= total}
              >
                Вперёд
                <Icon name="ChevronRight" size={16} className="ml-2" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LogEntriesViewer;
