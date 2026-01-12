import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const Dashboard2StatsCards = () => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '30px' }}>
      {/* Общие IT Расходы */}
      <Card style={{ background: '#111c44', border: '1px solid rgba(117, 81, 233, 0.4)', borderTop: '4px solid #7551e9', boxShadow: '0 0 30px rgba(117, 81, 233, 0.2), inset 0 0 15px rgba(117, 81, 233, 0.05)' }}>
        <CardContent className="p-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Общие IT Расходы</div>
              <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500' }}>Все время</div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(117, 81, 233, 0.1)', color: '#7551e9', border: '1px solid rgba(117, 81, 233, 0.2)' }}>
              <Icon name="Server" size={20} />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: '#fff' }}>184,200 ₽</div>
          <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>Общая сумма расходов</div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: '600', gap: '6px', color: '#e31a1a' }}>
            <Icon name="ArrowUp" size={14} /> +12.5% с прошлого месяца
          </div>
        </CardContent>
      </Card>

      {/* Серверная Инфраструктура */}
      <Card style={{ background: '#111c44', border: '1px solid rgba(1, 181, 116, 0.4)', borderTop: '4px solid #01b574', boxShadow: '0 0 30px rgba(1, 181, 116, 0.2), inset 0 0 15px rgba(1, 181, 116, 0.05)' }}>
        <CardContent className="p-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Серверная Инфраструктура</div>
              <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500' }}>Расходы на серверы</div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(1, 181, 116, 0.1)', color: '#01b574', border: '1px solid rgba(1, 181, 116, 0.2)' }}>
              <Icon name="Database" size={20} />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: '#fff' }}>98,500 ₽</div>
          <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>53.4% от общего бюджета</div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: '600', gap: '6px', color: '#e31a1a' }}>
            <Icon name="ArrowUp" size={14} /> +8.2% с прошлого месяца
          </div>
        </CardContent>
      </Card>

      {/* Коммуникационные Сервисы */}
      <Card style={{ background: '#111c44', border: '1px solid rgba(57, 101, 255, 0.4)', borderTop: '4px solid #3965ff', boxShadow: '0 0 30px rgba(57, 101, 255, 0.2), inset 0 0 15px rgba(57, 101, 255, 0.05)' }}>
        <CardContent className="p-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Коммуникационные Сервисы</div>
              <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500' }}>Телефония и мессенджеры</div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(57, 101, 255, 0.1)', color: '#3965ff', border: '1px solid rgba(57, 101, 255, 0.2)' }}>
              <Icon name="MessageCircle" size={20} />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: '#fff' }}>45,300 ₽</div>
          <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>24.6% от общего бюджета</div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: '600', gap: '6px', color: '#a3aed0' }}>
            <Icon name="Minus" size={14} /> Без изменений
          </div>
        </CardContent>
      </Card>

      {/* Всего Платежей */}
      <Card style={{ background: '#111c44', border: '1px solid rgba(255, 181, 71, 0.4)', borderTop: '4px solid #ffb547', boxShadow: '0 0 30px rgba(255, 181, 71, 0.2), inset 0 0 15px rgba(255, 181, 71, 0.05)' }}>
        <CardContent className="p-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Всего Платежей</div>
              <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500' }}>История операций</div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 181, 71, 0.1)', color: '#ffb547', border: '1px solid rgba(255, 181, 71, 0.2)' }}>
              <Icon name="Box" size={20} />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: '#fff' }}>23</div>
          <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>платежей за все время</div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: '600', gap: '6px', color: '#e31a1a' }}>
            <Icon name="ArrowUp" size={14} /> +3 за месяц
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard2StatsCards;