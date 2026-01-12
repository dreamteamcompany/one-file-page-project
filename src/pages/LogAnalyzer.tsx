import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { useToast } from '@/hooks/use-toast';
import LogAnalyzerHeader from '@/components/log-analyzer/LogAnalyzerHeader';
import LogFilesList from '@/components/log-analyzer/LogFilesList';
import LogFilters from '@/components/log-analyzer/LogFilters';
import LogEntriesViewer from '@/components/log-analyzer/LogEntriesViewer';

interface LogFile {
  id: number;
  filename: string;
  file_size: number;
  uploaded_at: string;
  total_lines: number;
  status: string;
  statistics: Array<{ level: string; count: number }>;
}

interface LogEntry {
  id: number;
  file_id: number;
  line_number: number;
  timestamp: string | null;
  level: string | null;
  message: string;
  raw_line: string;
}

const API_URL = 'https://functions.poehali.dev/dd221a88-cc33-4a30-a59f-830b0a41862f';
const COLLECT_API_URL = 'https://functions.poehali.dev/acbb6915-96bf-4e7f-ab66-c34c3fa4b26c';

const LogAnalyzer = () => {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<LogFile | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 100;
  const { toast } = useToast();

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

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      loadEntries();
    }
  }, [selectedFile, levelFilter, searchQuery, offset]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}?action=list`);
      if (!response.ok) throw new Error('Failed to load files');
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('Failed to load files:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список файлов',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'entries',
        file_id: selectedFile.id.toString(),
        limit: limit.toString(),
        offset: offset.toString(),
      });
      
      if (levelFilter) params.append('level', levelFilter);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`${API_URL}?${params}`);
      if (!response.ok) throw new Error('Failed to load entries');
      
      const data = await response.json();
      setEntries(data.entries);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to load entries:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить логи',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const collectAllLogs = async () => {
    setCollecting(true);
    try {
      const backendFunctions = [
        'main',
        'upload-file',
        'upload-photo',
        'savings-dashboard',
        'revoke-payment',
        'dashboard-layout',
        'dashboard-stats',
        'log-analyzer',
        'collect-logs'
      ];
      
      const sources = ['frontend', ...backendFunctions.map(fn => `backend/${fn}`)];
      
      const response = await fetch(COLLECT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources,
          limit: 1000
        }),
      });

      if (!response.ok) throw new Error('Collection failed');

      const result = await response.json();
      toast({
        title: 'Логи собраны!',
        description: `Собрано записей: ${result.collected} из ${result.sources_processed} источников`,
      });

      loadFiles();
    } catch (error) {
      console.error('Collection failed:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось собрать логи',
        variant: 'destructive',
      });
    } finally {
      setCollecting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const base64Content = btoa(content);

        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            file_content: base64Content,
          }),
        });

        if (!response.ok) throw new Error('Upload failed');

        const result = await response.json();
        toast({
          title: 'Успешно',
          description: `Файл загружен! Обработано строк: ${result.total_lines}`,
        });

        loadFiles();
        event.target.value = '';
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить файл',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const getLevelColor = (level: string | null) => {
    if (!level) return 'text-gray-400';
    const levelLower = level.toLowerCase();
    if (levelLower.includes('error') || levelLower.includes('fatal')) return 'text-red-400';
    if (levelLower.includes('warn')) return 'text-yellow-400';
    if (levelLower.includes('info')) return 'text-blue-400';
    if (levelLower.includes('debug') || levelLower.includes('trace')) return 'text-gray-400';
    return 'text-gray-300';
  };

  const getLevelBadgeVariant = (level: string | null): "default" | "destructive" | "secondary" | "outline" => {
    if (!level) return 'secondary';
    const levelLower = level.toLowerCase();
    if (levelLower.includes('error') || levelLower.includes('fatal')) return 'destructive';
    if (levelLower.includes('warn')) return 'outline';
    return 'secondary';
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString('ru-RU');
    } catch {
      return timestamp;
    }
  };

  const uniqueLevels = selectedFile
    ? Array.from(new Set(selectedFile.statistics.map((s) => s.level)))
    : [];

  const handleSelectFile = (file: LogFile) => {
    setSelectedFile(file);
    setOffset(0);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setOffset(0);
  };

  const handleLevelChange = (level: string) => {
    setLevelFilter(level);
    setOffset(0);
  };

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    setOffset(offset + limit);
  };

  return (
    <div className="flex min-h-screen">
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

      <main className="lg:ml-[250px] p-4 md:p-6 lg:p-[30px] min-h-screen flex-1 overflow-x-hidden max-w-full">
        <LogAnalyzerHeader
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          collecting={collecting}
          uploading={uploading}
          onCollectLogs={collectAllLogs}
          onFileUpload={handleFileUpload}
        />

        <Tabs defaultValue="files" className="space-y-4">
          <TabsList>
            <TabsTrigger value="files">
              <Icon name="FileText" size={16} className="mr-2" />
              Файлы ({files.length})
            </TabsTrigger>
            <TabsTrigger value="viewer" disabled={!selectedFile}>
              <Icon name="Eye" size={16} className="mr-2" />
              Просмотр логов
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <LogFilesList
              files={files}
              selectedFile={selectedFile}
              loading={loading}
              onSelectFile={handleSelectFile}
              formatTimestamp={formatTimestamp}
              getLevelBadgeVariant={getLevelBadgeVariant}
            />
          </TabsContent>

          <TabsContent value="viewer">
            {selectedFile && (
              <>
                <LogFilters
                  searchQuery={searchQuery}
                  levelFilter={levelFilter}
                  uniqueLevels={uniqueLevels}
                  onSearchChange={handleSearchChange}
                  onLevelChange={handleLevelChange}
                />

                <LogEntriesViewer
                  entries={entries}
                  loading={loading}
                  total={total}
                  offset={offset}
                  limit={limit}
                  onRefresh={loadEntries}
                  onPrevPage={handlePrevPage}
                  onNextPage={handleNextPage}
                  formatTimestamp={formatTimestamp}
                  getLevelColor={getLevelColor}
                  getLevelBadgeVariant={getLevelBadgeVariant}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default LogAnalyzer;
