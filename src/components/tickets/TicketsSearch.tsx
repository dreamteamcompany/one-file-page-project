import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

interface TicketsSearchProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

const TicketsSearch = ({ searchQuery, onSearchChange }: TicketsSearchProps) => {
  return (
    <div className="flex items-center gap-2 sm:gap-3 bg-card border border-white/10 rounded-[15px] px-3 sm:px-5 py-2 sm:py-3 mb-4 sm:mb-6">
      <Icon name="Search" size={18} className="text-muted-foreground sm:w-5 sm:h-5" />
      <Input
        type="text"
        placeholder="Поиск по заявкам..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto text-sm sm:text-base"
      />
    </div>
  );
};

export default TicketsSearch;