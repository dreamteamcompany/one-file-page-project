import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';

interface PaymentsSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const PaymentsSearch = ({ searchQuery, onSearchChange }: PaymentsSearchProps) => {
  return (
    <div className="mb-6">
      <div className="relative">
        <Icon name="Search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по описанию, категории, сумме, контрагенту..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-background border-white/10"
        />
      </div>
    </div>
  );
};

export default PaymentsSearch;
