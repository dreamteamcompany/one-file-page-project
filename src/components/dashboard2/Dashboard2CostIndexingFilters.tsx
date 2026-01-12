import Icon from '@/components/ui/icon';

interface Category {
  id: 'all' | 'it' | 'office' | 'marketing' | 'operations';
  name: string;
  icon: string;
  color: string;
}

interface Dashboard2CostIndexingFiltersProps {
  categories: Category[];
  selectedCategory: 'all' | 'it' | 'office' | 'marketing' | 'operations';
  onCategoryChange: (category: 'all' | 'it' | 'office' | 'marketing' | 'operations') => void;
}

const Dashboard2CostIndexingFilters = ({ categories, selectedCategory, onCategoryChange }: Dashboard2CostIndexingFiltersProps) => {
  return (
    <div style={{ 
      display: 'flex', 
      gap: '6px', 
      marginBottom: '16px',
      flexWrap: 'wrap'
    }} className="sm:gap-2.5 sm:mb-6">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange(cat.id)}
          className="px-3 py-2 sm:px-4 sm:py-2.5"
          style={{
            background: selectedCategory === cat.id 
              ? `linear-gradient(135deg, ${cat.color}30 0%, ${cat.color}15 100%)`
              : 'rgba(255, 255, 255, 0.03)',
            border: selectedCategory === cat.id 
              ? `1px solid ${cat.color}`
              : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            if (selectedCategory !== cat.id) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = cat.color;
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCategory !== cat.id) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          <Icon name={cat.icon} size={14} style={{ color: selectedCategory === cat.id ? cat.color : '#a3aed0' }} className="sm:w-4 sm:h-4" />
          <span style={{ 
            color: selectedCategory === cat.id ? cat.color : '#a3aed0',
            fontSize: '11px',
            fontWeight: selectedCategory === cat.id ? '700' : '600'
          }} className="sm:text-xs">
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
};

export default Dashboard2CostIndexingFilters;