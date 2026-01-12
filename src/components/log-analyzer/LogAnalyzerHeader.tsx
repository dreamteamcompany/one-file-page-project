import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface LogAnalyzerHeaderProps {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  collecting: boolean;
  uploading: boolean;
  onCollectLogs: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const LogAnalyzerHeader = ({
  menuOpen,
  setMenuOpen,
  collecting,
  uploading,
  onCollectLogs,
  onFileUpload,
}: LogAnalyzerHeaderProps) => {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden p-2 text-white"
        >
          <Icon name="Menu" size={24} />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Анализатор логов</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Загружайте и анализируйте файлы логов
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={onCollectLogs} disabled={collecting} variant="default">
          {collecting ? (
            <>
              <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
              Сбор логов...
            </>
          ) : (
            <>
              <Icon name="Download" size={18} className="mr-2" />
              Собрать все логи
            </>
          )}
        </Button>
        
        <Input
          type="file"
          accept=".log,.txt"
          onChange={onFileUpload}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />
        <Label htmlFor="file-upload">
          <Button disabled={uploading} variant="outline" asChild>
            <span className="cursor-pointer">
              {uploading ? (
                <>
                  <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Icon name="Upload" size={18} className="mr-2" />
                  Загрузить файл
                </>
              )}
            </span>
          </Button>
        </Label>
      </div>
    </header>
  );
};

export default LogAnalyzerHeader;
