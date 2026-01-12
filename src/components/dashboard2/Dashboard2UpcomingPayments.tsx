import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useEffect, useState } from 'react';

const Dashboard2UpcomingPayments = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getTimeUntil = (daysFromNow: number, hours: number = 14, minutes: number = 0) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    target.setHours(hours, minutes, 0, 0);
    
    const diff = target.getTime() - currentTime.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { days, hours: hrs, minutes: mins, seconds: secs, total: diff };
  };

  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(255, 181, 71, 0.3)',
      boxShadow: '0 0 40px rgba(255, 181, 71, 0.2), inset 0 0 30px rgba(255, 181, 71, 0.08)',
      position: 'relative',
      overflow: 'hidden',
      marginBottom: '30px'
    }}>
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-30%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(255, 181, 71, 0.12) 0%, transparent 60%)',
        pointerEvents: 'none',
        animation: 'breathe 6s infinite'
      }} />
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }} className="sm:flex-row sm:justify-between sm:items-center sm:mb-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="sm:gap-3">
            <div style={{ 
              background: 'linear-gradient(135deg, #ffb547 0%, #ff9500 100%)',
              padding: '10px',
              borderRadius: '12px',
              boxShadow: '0 0 25px rgba(255, 181, 71, 0.6)',
              animation: 'pulse 2s infinite'
            }} className="sm:p-3.5">
              <Icon name="Clock" size={20} style={{ color: '#fff' }} className="sm:w-7 sm:h-7" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }} className="sm:text-xl md:text-2xl">Предстоящие Платежи</h3>
              <p style={{ fontSize: '11px', color: '#a3aed0', marginTop: '2px' }} className="sm:text-sm sm:mt-1">Ближайшие 7 дней • Следите за дедлайнами</p>
            </div>
          </div>
          <div style={{ 
            background: 'rgba(255, 181, 71, 0.15)',
            padding: '8px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 181, 71, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }} className="sm:px-6 sm:py-3">
            <Icon name="AlertCircle" size={16} style={{ color: '#ffb547' }} className="sm:w-[18px] sm:h-[18px]" />
            <span style={{ color: '#ffb547', fontSize: '12px', fontWeight: '700' }} className="sm:text-sm">7 платежей</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { 
              name: 'AWS Cloud Services', 
              amount: 45000, 
              category: 'Серверы', 
              icon: 'Server',
              daysFromNow: 0,
              hours: 18,
              urgent: true,
              color: '#ff6b6b'
            },
            { 
              name: 'Microsoft 365 Business', 
              amount: 42000, 
              category: 'SaaS', 
              icon: 'Cloud',
              daysFromNow: 1,
              hours: 10,
              urgent: true,
              color: '#ff6b6b'
            },
            { 
              name: 'Adobe Creative Cloud', 
              amount: 28000, 
              category: 'Софт', 
              icon: 'Palette',
              daysFromNow: 2,
              hours: 14,
              urgent: false,
              color: '#ffb547'
            },
            { 
              name: 'GitHub Enterprise', 
              amount: 18500, 
              category: 'Dev Tools', 
              icon: 'Code',
              daysFromNow: 3,
              hours: 12,
              urgent: false,
              color: '#ffb547'
            },
            { 
              name: 'CloudFlare Pro Plan', 
              amount: 12000, 
              category: 'Безопасность', 
              icon: 'Shield',
              daysFromNow: 5,
              hours: 9,
              urgent: false,
              color: '#01b574'
            },
            { 
              name: 'Figma Organization', 
              amount: 15000, 
              category: 'Дизайн', 
              icon: 'Figma',
              daysFromNow: 6,
              hours: 16,
              urgent: false,
              color: '#01b574'
            },
            { 
              name: 'MongoDB Atlas', 
              amount: 22000, 
              category: 'База Данных', 
              icon: 'Database',
              daysFromNow: 7,
              hours: 11,
              urgent: false,
              color: '#7551e9'
            }
          ].map((payment, idx) => {
            const countdown = getTimeUntil(payment.daysFromNow, payment.hours);
            const isExpiringSoon = countdown.days === 0;
            
            return (
              <div key={idx} style={{ 
                background: payment.urgent 
                  ? 'linear-gradient(135deg, rgba(255, 107, 107, 0.15) 0%, rgba(255, 107, 107, 0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                padding: '18px',
                borderRadius: '14px',
                border: payment.urgent 
                  ? '1px solid rgba(255, 107, 107, 0.4)' 
                  : '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: payment.urgent ? '0 0 20px rgba(255, 107, 107, 0.2)' : 'none',
                animation: payment.urgent ? 'glow 2s infinite' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(8px)';
                e.currentTarget.style.boxShadow = `0 10px 40px ${payment.color}40`;
                e.currentTarget.style.borderColor = payment.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = payment.urgent ? '0 0 20px rgba(255, 107, 107, 0.2)' : 'none';
                e.currentTarget.style.borderColor = payment.urgent 
                  ? 'rgba(255, 107, 107, 0.4)' 
                  : 'rgba(255, 255, 255, 0.08)';
              }}>
                {payment.urgent && (
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '4px',
                    height: '100%',
                    background: 'linear-gradient(180deg, #ff6b6b 0%, #ee5a52 100%)',
                    boxShadow: '0 0 15px #ff6b6b',
                    animation: 'pulse 1.5s infinite'
                  }} />
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    background: `linear-gradient(135deg, ${payment.color} 0%, ${payment.color}cc 100%)`,
                    padding: '14px',
                    borderRadius: '12px',
                    boxShadow: `0 0 20px ${payment.color}60`,
                    flexShrink: 0
                  }}>
                    <Icon name={payment.icon} size={24} style={{ color: '#fff' }} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>
                        {payment.name}
                      </h4>
                      {payment.urgent && (
                        <div style={{
                          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '800',
                          color: '#fff',
                          textTransform: 'uppercase',
                          boxShadow: '0 0 10px rgba(255, 107, 107, 0.5)',
                          animation: 'pulse 1.5s infinite'
                        }}>
                          Срочно
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ 
                        color: '#a3aed0', 
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Icon name="Tag" size={14} style={{ color: payment.color }} />
                        {payment.category}
                      </span>
                      <span style={{ color: '#7551e9', fontSize: '14px', fontWeight: '700' }}>
                        {new Intl.NumberFormat('ru-RU').format(payment.amount)} ₽
                      </span>
                    </div>
                  </div>

                  <div style={{ 
                    background: isExpiringSoon 
                      ? 'rgba(255, 107, 107, 0.15)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    border: isExpiringSoon 
                      ? '1px solid rgba(255, 107, 107, 0.3)' 
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    minWidth: '160px',
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      color: isExpiringSoon ? '#ff6b6b' : '#a3aed0', 
                      fontSize: '11px', 
                      fontWeight: '600',
                      marginBottom: '6px',
                      textTransform: 'uppercase'
                    }}>
                      {isExpiringSoon ? 'Осталось' : 'До платежа'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {countdown.days > 0 && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ 
                            color: isExpiringSoon ? '#ff6b6b' : payment.color, 
                            fontSize: '20px', 
                            fontWeight: '900',
                            textShadow: `0 0 15px ${isExpiringSoon ? '#ff6b6b' : payment.color}60`
                          }}>
                            {countdown.days}
                          </div>
                          <div style={{ color: '#a3aed0', fontSize: '9px', fontWeight: '600' }}>
                            ДН
                          </div>
                        </div>
                      )}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          color: isExpiringSoon ? '#ff6b6b' : payment.color, 
                          fontSize: '20px', 
                          fontWeight: '900',
                          textShadow: `0 0 15px ${isExpiringSoon ? '#ff6b6b' : payment.color}60`
                        }}>
                          {String(countdown.hours).padStart(2, '0')}
                        </div>
                        <div style={{ color: '#a3aed0', fontSize: '9px', fontWeight: '600' }}>
                          ЧС
                        </div>
                      </div>
                      <div style={{ 
                        color: isExpiringSoon ? '#ff6b6b' : '#7551e9', 
                        fontSize: '20px', 
                        fontWeight: '900',
                        display: 'flex',
                        alignItems: 'center'
                      }}>:</div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          color: isExpiringSoon ? '#ff6b6b' : payment.color, 
                          fontSize: '20px', 
                          fontWeight: '900',
                          textShadow: `0 0 15px ${isExpiringSoon ? '#ff6b6b' : payment.color}60`
                        }}>
                          {String(countdown.minutes).padStart(2, '0')}
                        </div>
                        <div style={{ color: '#a3aed0', fontSize: '9px', fontWeight: '600' }}>
                          МН
                        </div>
                      </div>
                      {isExpiringSoon && (
                        <>
                          <div style={{ 
                            color: '#ff6b6b', 
                            fontSize: '20px', 
                            fontWeight: '900',
                            display: 'flex',
                            alignItems: 'center'
                          }}>:</div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ 
                              color: '#ff6b6b', 
                              fontSize: '20px', 
                              fontWeight: '900',
                              textShadow: '0 0 15px rgba(255, 107, 107, 0.6)'
                            }}>
                              {String(countdown.seconds).padStart(2, '0')}
                            </div>
                            <div style={{ color: '#a3aed0', fontSize: '9px', fontWeight: '600' }}>
                              СК
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary footer */}
        <div style={{ 
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ color: '#a3aed0', fontSize: '12px', marginBottom: '4px' }}>
                Общая сумма
              </div>
              <div style={{ 
                color: '#ffb547', 
                fontSize: '24px', 
                fontWeight: '800',
                textShadow: '0 0 20px rgba(255, 181, 71, 0.5)'
              }}>
                ₽182.5K
              </div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.05)' }} />
            <div>
              <div style={{ color: '#a3aed0', fontSize: '12px', marginBottom: '4px' }}>
                Срочных платежей
              </div>
              <div style={{ 
                color: '#ff6b6b', 
                fontSize: '24px', 
                fontWeight: '800',
                textShadow: '0 0 20px rgba(255, 107, 107, 0.5)'
              }}>
                2
              </div>
            </div>
          </div>
          <div style={{ 
            background: 'linear-gradient(135deg, #7551e9 0%, #5a3ec5 100%)',
            padding: '12px 24px',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 0 20px rgba(117, 81, 233, 0.4)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(117, 81, 233, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(117, 81, 233, 0.4)';
          }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: '700' }}>
              Запланировать платежи
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard2UpcomingPayments;