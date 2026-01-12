import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Chart, registerables } from 'chart.js';
import Dashboard2ChartsSection from './Dashboard2ChartsSection';
import Dashboard2StatsRow from './Dashboard2StatsRow';
import Dashboard2KPIRow from './Dashboard2KPIRow';
import Dashboard2PaymentCalendar from './Dashboard2PaymentCalendar';
import Dashboard2UpcomingPayments from './Dashboard2UpcomingPayments';
import Dashboard2TeamPerformance from './Dashboard2TeamPerformance';
import Dashboard2ServicesDynamics from './Dashboard2ServicesDynamics';
import Dashboard2CostIndexing from './Dashboard2CostIndexing';
import Dashboard2BudgetBreakdown from './Dashboard2BudgetBreakdown';

Chart.register(...registerables);

interface BlockLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  component: string;
}

interface DragState {
  isDragging: boolean;
  blockId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  isResizing: boolean;
  blockId: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  handle: string;
}

const Dashboard2FullEditableLayout = () => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<BlockLayout[]>([]);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    blockId: '',
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    blockId: '',
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    handle: '',
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultLayouts: BlockLayout[] = [
    { id: 'charts-section', x: 0, y: 0, width: 1150, height: 1000, component: 'Dashboard2ChartsSection' },
    { id: 'stats-row', x: 0, y: 1020, width: 1150, height: 450, component: 'Dashboard2StatsRow' },
    { id: 'kpi-row', x: 0, y: 1490, width: 1150, height: 350, component: 'Dashboard2KPIRow' },
    { id: 'payment-calendar', x: 0, y: 1860, width: 1150, height: 500, component: 'Dashboard2PaymentCalendar' },
    { id: 'upcoming-payments', x: 0, y: 2380, width: 1150, height: 550, component: 'Dashboard2UpcomingPayments' },
    { id: 'team-performance', x: 0, y: 2950, width: 1150, height: 600, component: 'Dashboard2TeamPerformance' },
    { id: 'services-dynamics', x: 0, y: 3570, width: 1150, height: 200, component: 'Dashboard2ServicesDynamics' },
    { id: 'cost-indexing', x: 0, y: 3790, width: 1150, height: 550, component: 'Dashboard2CostIndexing' },
    { id: 'budget-breakdown', x: 0, y: 4360, width: 1150, height: 400, component: 'Dashboard2BudgetBreakdown' },
  ];

  const componentMap: Record<string, React.ComponentType> = {
    Dashboard2ChartsSection,
    Dashboard2StatsRow,
    Dashboard2KPIRow,
    Dashboard2PaymentCalendar,
    Dashboard2UpcomingPayments,
    Dashboard2TeamPerformance,
    Dashboard2ServicesDynamics,
    Dashboard2CostIndexing,
    Dashboard2BudgetBreakdown,
  };

  useEffect(() => {
    const loadLayouts = async () => {
      try {
        const response = await fetch('https://functions.poehali.dev/5977014b-b187-49a2-8bf6-4ffb51e2aaeb', {
          method: 'GET',
          headers: {
            'X-User-Id': 'admin',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.layouts && data.layouts.length > 0) {
            const loadedLayouts = data.layouts.map((l: any) => ({
              id: l.card_id,
              x: l.x,
              y: l.y,
              width: l.width,
              height: l.height,
              component: defaultLayouts.find(d => d.id === l.card_id)?.component || 'Dashboard2ChartsSection'
            }));
            setLayouts(loadedLayouts);
          } else {
            setLayouts(defaultLayouts);
          }
        } else {
          setLayouts(defaultLayouts);
        }
      } catch (error) {
        console.error('Failed to load layouts:', error);
        setLayouts(defaultLayouts);
      }
    };
    
    loadLayouts();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        
        setLayouts(prev => prev.map(l => 
          l.id === dragState.blockId 
            ? { ...l, x: Math.max(0, dragState.offsetX + deltaX), y: Math.max(0, dragState.offsetY + deltaY) }
            : l
        ));
      }
      
      if (resizeState.isResizing) {
        const deltaX = e.clientX - resizeState.startX;
        const deltaY = e.clientY - resizeState.startY;
        
        setLayouts(prev => prev.map(l => {
          if (l.id !== resizeState.blockId) return l;
          
          const newLayout = { ...l };
          
          if (resizeState.handle.includes('right')) {
            newLayout.width = Math.max(400, resizeState.startWidth + deltaX);
          }
          if (resizeState.handle.includes('left')) {
            const newWidth = Math.max(400, resizeState.startWidth - deltaX);
            const widthDiff = resizeState.startWidth - newWidth;
            newLayout.width = newWidth;
            newLayout.x = l.x + widthDiff;
          }
          if (resizeState.handle.includes('bottom')) {
            newLayout.height = Math.max(200, resizeState.startHeight + deltaY);
          }
          if (resizeState.handle.includes('top')) {
            const newHeight = Math.max(200, resizeState.startHeight - deltaY);
            const heightDiff = resizeState.startHeight - newHeight;
            newLayout.height = newHeight;
            newLayout.y = l.y + heightDiff;
          }
          
          return newLayout;
        }));
      }
    };

    const handleMouseUp = () => {
      setDragState(prev => ({ ...prev, isDragging: false }));
      setResizeState(prev => ({ ...prev, isResizing: false }));
    };

    if (dragState.isDragging || resizeState.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, resizeState]);

  const handleSave = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/5977014b-b187-49a2-8bf6-4ffb51e2aaeb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'admin',
        },
        body: JSON.stringify({ layouts }),
      });
      
      if (response.ok) {
        setIsEditMode(false);
        alert('Расположение сохранено!');
      } else {
        alert('Ошибка при сохранении');
      }
    } catch (error) {
      console.error('Failed to save layouts:', error);
      alert('Ошибка при сохранении');
    }
  };

  const handleReset = async () => {
    if (confirm('Сбросить расположение к исходному?')) {
      setLayouts(defaultLayouts);
      try {
        await fetch('https://functions.poehali.dev/5977014b-b187-49a2-8bf6-4ffb51e2aaeb', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': 'admin',
          },
          body: JSON.stringify({ layouts: defaultLayouts }),
        });
      } catch (error) {
        console.error('Failed to reset layouts:', error);
      }
    }
  };

  const handleDragStart = (e: React.MouseEvent, blockId: string) => {
    if (!isEditMode) return;
    
    const layout = layouts.find(l => l.id === blockId);
    if (!layout) return;
    
    setDragState({
      isDragging: true,
      blockId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: layout.x,
      offsetY: layout.y,
    });
  };

  const handleResizeStart = (e: React.MouseEvent, blockId: string, handle: string) => {
    if (!isEditMode) return;
    e.stopPropagation();
    
    const layout = layouts.find(l => l.id === blockId);
    if (!layout) return;
    
    setResizeState({
      isResizing: true,
      blockId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: layout.width,
      startHeight: layout.height,
      handle,
    });
  };

  const renderResizeHandles = (blockId: string) => {
    if (!isEditMode) return null;
    
    const handleStyle = {
      position: 'absolute' as const,
      background: '#7551e9',
      zIndex: 10,
    };
    
    return (
      <>
        <div style={{ ...handleStyle, top: 0, left: 0, width: '10px', height: '10px', cursor: 'nwse-resize' }} 
             onMouseDown={(e) => handleResizeStart(e, blockId, 'top-left')} />
        <div style={{ ...handleStyle, top: 0, right: 0, width: '10px', height: '10px', cursor: 'nesw-resize' }} 
             onMouseDown={(e) => handleResizeStart(e, blockId, 'top-right')} />
        <div style={{ ...handleStyle, bottom: 0, left: 0, width: '10px', height: '10px', cursor: 'nesw-resize' }} 
             onMouseDown={(e) => handleResizeStart(e, blockId, 'bottom-left')} />
        <div style={{ ...handleStyle, bottom: 0, right: 0, width: '10px', height: '10px', cursor: 'nwse-resize' }} 
             onMouseDown={(e) => handleResizeStart(e, blockId, 'bottom-right')} />
        <div style={{ ...handleStyle, top: 0, left: '50%', transform: 'translateX(-50%)', width: '40px', height: '6px', cursor: 'ns-resize' }} 
             onMouseDown={(e) => handleResizeStart(e, blockId, 'top')} />
        <div style={{ ...handleStyle, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '40px', height: '6px', cursor: 'ns-resize' }} 
             onMouseDown={(e) => handleResizeStart(e, blockId, 'bottom')} />
        <div style={{ ...handleStyle, left: 0, top: '50%', transform: 'translateY(-50%)', width: '6px', height: '40px', cursor: 'ew-resize' }} 
             onMouseDown={(e) => handleResizeStart(e, blockId, 'left')} />
        <div style={{ ...handleStyle, right: 0, top: '50%', transform: 'translateY(-50%)', width: '6px', height: '40px', cursor: 'ew-resize' }} 
             onMouseDown={(e) => handleResizeStart(e, blockId, 'right')} />
      </>
    );
  };

  return (
    <div style={{ marginBottom: '30px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '16px',
        background: isEditMode ? 'rgba(117, 81, 233, 0.1)' : 'transparent',
        borderRadius: '12px',
        border: isEditMode ? '2px solid rgba(117, 81, 233, 0.3)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        <div>
          {isEditMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="Edit" size={20} style={{ color: '#7551e9' }} />
              <span style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>
                Режим редактирования активен
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {isEditMode ? (
            <>
              <Button variant="outline" onClick={handleReset}>
                <Icon name="RotateCcw" size={16} className="mr-2" />
                Сбросить
              </Button>
              <Button variant="outline" onClick={() => setIsEditMode(false)}>
                <Icon name="X" size={16} className="mr-2" />
                Отмена
              </Button>
              <Button onClick={handleSave}>
                <Icon name="Save" size={16} className="mr-2" />
                Сохранить
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditMode(true)}>
              <Icon name="Edit" size={16} className="mr-2" />
              Редактировать
            </Button>
          )}
        </div>
      </div>

      <div ref={containerRef} style={{ position: 'relative', minHeight: '5000px' }}>
        {layouts.map((layout) => {
          const Component = componentMap[layout.component];
          if (!Component) return null;

          return (
            <div
              key={layout.id}
              style={{
                position: 'absolute',
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
                cursor: isEditMode ? 'move' : 'default',
                overflow: isEditMode ? 'hidden' : 'visible',
              }}
              onMouseDown={(e) => handleDragStart(e, layout.id)}
            >
              <div style={{
                border: isEditMode ? '2px dashed rgba(117, 81, 233, 0.5)' : 'none',
                borderRadius: '16px',
                height: '100%',
                overflow: 'auto',
                userSelect: 'none',
                pointerEvents: isEditMode ? 'none' : 'auto',
              }}>
                <Component />
              </div>
              {renderResizeHandles(layout.id)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard2FullEditableLayout;