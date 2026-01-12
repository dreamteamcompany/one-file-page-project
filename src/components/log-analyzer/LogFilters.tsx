import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface LogFiltersProps {
  searchQuery: string;
  levelFilter: string;
  uniqueLevels: string[];
  onSearchChange: (query: string) => void;
  onLevelChange: (level: string) => void;
}

const LogFilters = ({
  searchQuery,
  levelFilter,
  uniqueLevels,
  onSearchChange,
  onLevelChange,
}: LogFiltersProps) => {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Фильтры</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Поиск</Label>
            <div className="relative">
              <Icon
                name="Search"
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Поиск по сообщению..."
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label>Уровень</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={levelFilter === '' ? 'default' : 'outline'}
                onClick={() => onLevelChange('')}
              >
                Все
              </Button>
              {uniqueLevels.map((level) => (
                <Button
                  key={level}
                  size="sm"
                  variant={levelFilter === level ? 'default' : 'outline'}
                  onClick={() => onLevelChange(level)}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LogFilters;
