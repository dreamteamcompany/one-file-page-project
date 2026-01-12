import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

interface TicketsSearchProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

const TicketsSearch = ({ searchQuery, onSearchChange }: TicketsSearchProps) => {
  return (
    <div className="flex items-center gap-3 bg-card border border-white/10 rounded-[15px] px-5 py-3 mb-6">
      <Icon name="Search" size={20} className="text-muted-foreground" />
      <Input
        type="text"
        placeholder="Поиск по заявкам..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
      />
    </div>
  );
};

export default TicketsSearch;
