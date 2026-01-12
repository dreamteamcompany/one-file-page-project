import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const Dashboard2PaymentCalendar = () => {
  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(117, 81, 233, 0.3)',
      boxShadow: '0 0 40px rgba(117, 81, 233, 0.2), inset 0 0 30px rgba(117, 81, 233, 0.08)',
      position: 'relative',
      overflow: 'hidden',
      marginBottom: '30px'
    }}>
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at 20% 50%, rgba(117, 81, 233, 0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }} className="sm:flex-row sm:justify-between sm:items-center sm:mb-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="sm:gap-3">
            <div style={{ 
              background: 'linear-gradient(135deg, #7551e9 0%, #5a3ec5 100%)',
              padding: '10px',
              borderRadius: '12px',
              boxShadow: '0 0 25px rgba(117, 81, 233, 0.6)'
            }} className="sm:p-3.5">
              <Icon name="Calendar" size={20} style={{ color: '#fff' }} className="sm:w-7 sm:h-7" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }} className="sm:text-xl md:text-2xl">Календарь Платежей</h3>
              <p style={{ fontSize: '11px', color: '#a3aed0', marginTop: '2px' }} className="sm:text-sm sm:mt-1">Декабрь 2024 • Распределение по дням</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }} className="sm:flex-row sm:gap-4 sm:items-center">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} className="sm:gap-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(135deg, #01b574 0%, #018c5a 100%)', boxShadow: '0 0 10px #01b574' }} />
                <span style={{ color: '#a3aed0', fontSize: '11px' }} className="sm:text-xs">Малые</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(135deg, #ffb547 0%, #ff9500 100%)', boxShadow: '0 0 10px #ffb547' }} />
                <span style={{ color: '#a3aed0', fontSize: '11px' }} className="sm:text-xs">Средние</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)', boxShadow: '0 0 10px #ff6b6b' }} />
                <span style={{ color: '#a3aed0', fontSize: '11px' }} className="sm:text-xs">Крупные</span>
              </div>
            </div>
            <div style={{ 
              background: 'rgba(117, 81, 233, 0.15)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(117, 81, 233, 0.3)'
            }} className="sm:px-4 sm:py-2">
              <span style={{ color: '#7551e9', fontSize: '12px', fontWeight: '700' }} className="sm:text-sm">18 платежей</span>
            </div>
          </div>
        </div>

        {/* Days of week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '8px' }} className="sm:gap-3 sm:mb-3">
          {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((day, idx) => (
            <div key={idx} style={{ 
              textAlign: 'center', 
              color: '#7551e9', 
              fontSize: '10px', 
              fontWeight: '700',
              padding: '4px'
            }} className="sm:text-xs sm:p-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }} className="sm:gap-3">
          {(() => {
            const days = [];
            const paymentsData = {
              2: { amount: 15000, category: 'small', payments: ['Zoom: ₽8K', 'Slack: ₽7K'] },
              5: { amount: 45000, category: 'large', payments: ['AWS: ₽45K'] },
              8: { amount: 22000, category: 'medium', payments: ['Adobe: ₽22K'] },
              12: { amount: 8500, category: 'small', payments: ['GitHub: ₽8.5K'] },
              15: { amount: 67000, category: 'large', payments: ['Microsoft: ₽42K', 'Security: ₽25K'] },
              16: { amount: 0, category: 'today', payments: [] },
              19: { amount: 18000, category: 'medium', payments: ['Figma: ₽18K'] },
              22: { amount: 12000, category: 'small', payments: ['Postman: ₽12K'] },
              25: { amount: 52000, category: 'large', payments: ['Servers: ₽52K'] },
              28: { amount: 28000, category: 'medium', payments: ['Database: ₽28K'] },
              30: { amount: 95000, category: 'large', payments: ['Azure: ₽60K', 'DevTools: ₽35K'] }
            };

            const today = 16;

            for (let i = 1; i <= 31; i++) {
              const dayData = paymentsData[i];
              const isToday = i === today;
              
              let bgColor = 'rgba(255, 255, 255, 0.02)';
              let borderColor = 'rgba(255, 255, 255, 0.05)';
              let glowColor = 'transparent';
              let textColor = '#a3aed0';
              
              if (isToday) {
                bgColor = 'rgba(117, 81, 233, 0.2)';
                borderColor = '#7551e9';
                glowColor = 'rgba(117, 81, 233, 0.4)';
                textColor = '#fff';
              } else if (dayData && dayData.amount > 0) {
                if (dayData.category === 'small') {
                  bgColor = 'rgba(1, 181, 116, 0.15)';
                  borderColor = 'rgba(1, 181, 116, 0.4)';
                  glowColor = 'rgba(1, 181, 116, 0.3)';
                  textColor = '#01b574';
                } else if (dayData.category === 'medium') {
                  bgColor = 'rgba(255, 181, 71, 0.15)';
                  borderColor = 'rgba(255, 181, 71, 0.4)';
                  glowColor = 'rgba(255, 181, 71, 0.3)';
                  textColor = '#ffb547';
                } else if (dayData.category === 'large') {
                  bgColor = 'rgba(255, 107, 107, 0.15)';
                  borderColor = 'rgba(255, 107, 107, 0.4)';
                  glowColor = 'rgba(255, 107, 107, 0.3)';
                  textColor = '#ff6b6b';
                }
              }

              days.push(
                <div
                  key={i}
                  style={{
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    padding: '6px',
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    cursor: dayData ? 'pointer' : 'default',
                    boxShadow: isToday ? `0 0 20px ${glowColor}, inset 0 0 20px ${glowColor}` : 'none',
                    animation: isToday ? 'pulse 2s infinite' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (dayData && dayData.amount > 0) {
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
                      e.currentTarget.style.boxShadow = `0 10px 30px ${glowColor}, 0 0 20px ${glowColor}`;
                      e.currentTarget.style.zIndex = '10';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = isToday ? `0 0 20px ${glowColor}, inset 0 0 20px ${glowColor}` : 'none';
                    e.currentTarget.style.zIndex = '1';
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: dayData && dayData.amount > 0 ? '8px' : '0'
                  }}>
                    <span style={{ 
                      color: textColor, 
                      fontSize: '12px', 
                      fontWeight: '700',
                      textShadow: isToday ? `0 0 10px ${glowColor}` : 'none'
                    }} className="sm:text-base">
                      {i}
                    </span>
                    {isToday && (
                      <div style={{
                        background: 'linear-gradient(135deg, #7551e9 0%, #5a3ec5 100%)',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        fontSize: '8px',
                        fontWeight: '700',
                        color: '#fff',
                        textTransform: 'uppercase',
                        boxShadow: '0 0 10px rgba(117, 81, 233, 0.5)'
                      }} className="sm:text-[9px] sm:px-1.5">
                        Сегодня
                      </div>
                    )}
                  </div>
                  {dayData && dayData.amount > 0 && (
                    <>
                      <div style={{ 
                        color: textColor, 
                        fontSize: '11px', 
                        fontWeight: '800',
                        marginBottom: '4px',
                        textShadow: `0 0 15px ${glowColor}`
                      }} className="sm:text-sm sm:mb-1.5">
                        {new Intl.NumberFormat('ru-RU').format(dayData.amount)} ₽
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '3px',
                        fontSize: '11px',
                        color: '#a3aed0'
                      }}>
                        {dayData.payments.map((payment, idx) => (
                          <div key={idx} style={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            • {payment}
                          </div>
                        ))}
                      </div>
                      <div style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: textColor,
                        boxShadow: `0 0 10px ${textColor}`,
                        animation: dayData.category === 'large' ? 'pulse 2s infinite' : 'none'
                      }} />
                    </>
                  )}
                </div>
              );
            }
            return days;
          })()}
        </div>

        {/* Summary stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '16px',
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          {[
            { icon: 'TrendingUp', label: 'Всего за месяц', value: '₽390.5K', color: '#7551e9' },
            { icon: 'Calendar', label: 'Дней с платежами', value: '11', color: '#3965ff' },
            { icon: 'DollarSign', label: 'Средний чек', value: '₽35.5K', color: '#01b574' },
            { icon: 'Target', label: 'Самый крупный', value: '₽95K', color: '#ff6b6b' }
          ].map((stat, idx) => (
            <div key={idx} style={{ 
              background: `linear-gradient(135deg, ${stat.color}15 0%, ${stat.color}08 100%)`,
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${stat.color}30`,
              textAlign: 'center',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `0 10px 30px ${stat.color}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <Icon name={stat.icon} size={20} style={{ color: stat.color, marginBottom: '8px' }} />
              <div style={{ 
                color: stat.color, 
                fontSize: '20px', 
                fontWeight: '800',
                marginBottom: '4px',
                textShadow: `0 0 15px ${stat.color}60`
              }}>
                {stat.value}
              </div>
              <div style={{ color: '#a3aed0', fontSize: '11px', fontWeight: '600' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard2PaymentCalendar;