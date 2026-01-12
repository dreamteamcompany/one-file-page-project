import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const IndexationCard = () => {
  return (
    <Card style={{ background: '#111c44', border: '1px solid rgba(255, 181, 71, 0.4)', borderTop: '4px solid #ffb547', boxShadow: '0 0 30px rgba(255, 181, 71, 0.2), inset 0 0 15px rgba(255, 181, 71, 0.05)' }}>
      <CardContent className="p-4 sm:p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }} className="sm:mb-5">
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px', color: '#fff' }} className="sm:text-lg sm:mb-2">Индексация</div>
            <div style={{ color: '#a3aed0', fontSize: '12px', fontWeight: '500' }} className="sm:text-sm">Корректировка цен</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 181, 71, 0.1)', color: '#ffb547', border: '1px solid rgba(255, 181, 71, 0.2)' }} className="sm:w-12 sm:h-12">
            <Icon name="TrendingUp" size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>
        <div style={{ fontSize: '24px', fontWeight: '800', marginBottom: '6px', color: '#fff' }} className="sm:text-3xl sm:mb-2">45,780 ₽</div>
        <div style={{ color: '#a3aed0', fontSize: '12px', fontWeight: '500', marginBottom: '10px' }} className="sm:text-sm sm:mb-3">за текущий период</div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: '600', gap: '4px', color: '#01b574' }} className="sm:text-sm sm:gap-1.5">
          <Icon name="ArrowUp" size={12} className="sm:w-3.5 sm:h-3.5" /> +15.3% к предыдущему периоду
        </div>
      </CardContent>
    </Card>
  );
};

export default IndexationCard;