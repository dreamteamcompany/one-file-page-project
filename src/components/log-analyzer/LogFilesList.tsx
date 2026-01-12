import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface LogFile {
  id: number;
  filename: string;
  file_size: number;
  uploaded_at: string;
  total_lines: number;
  status: string;
  statistics: Array<{ level: string; count: number }>;
}

interface LogFilesListProps {
  files: LogFile[];
  selectedFile: LogFile | null;
  loading: boolean;
  onSelectFile: (file: LogFile) => void;
  formatTimestamp: (timestamp: string | null) => string;
  getLevelBadgeVariant: (level: string | null) => "default" | "destructive" | "secondary" | "outline";
}

const LogFilesList = ({
  files,
  selectedFile,
  loading,
  onSelectFile,
  formatTimestamp,
  getLevelBadgeVariant,
}: LogFilesListProps) => {
  if (loading && files.length === 0) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Icon name="Loader2" size={32} className="animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col justify-center items-center py-12 text-center">
          <Icon name="FileX" size={48} className="text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Нет загруженных файлов</h3>
          <p className="text-muted-foreground">
            Загрузите файл логов для начала анализа
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {files.map((file) => (
        <Card
          key={file.id}
          className={`cursor-pointer transition-colors ${
            selectedFile?.id === file.id ? 'border-primary' : ''
          }`}
          onClick={() => onSelectFile(file)}
        >
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{file.filename}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatTimestamp(file.uploaded_at)} • {file.total_lines} строк • {(
                    file.file_size / 1024
                  ).toFixed(2)}{' '}
                  KB
                </p>
              </div>
              <Badge variant={file.status === 'completed' ? 'default' : 'secondary'}>
                {file.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {file.statistics.map((stat) => (
                <Badge key={stat.level} variant={getLevelBadgeVariant(stat.level)}>
                  {stat.level}: {stat.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default LogFilesList;
