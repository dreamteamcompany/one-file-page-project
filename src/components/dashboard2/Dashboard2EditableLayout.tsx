import { useState, useEffect, useRef } from 'react';
import EditableCard from './EditableCard';
import EditModeToolbar from './EditModeToolbar';
import { dashboardCards, DashboardCard } from './DashboardCardsData';

interface CardLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  isDragging: boolean;
  cardId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  isResizing: boolean;
  cardId: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  handle: string;
}

const Dashboard2EditableLayout = () => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<CardLayout[]>([]);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    cardId: '',
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    cardId: '',
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    handle: '',
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultLayouts: CardLayout[] = [
    { id: 'total-expenses', x: 0, y: 0, width: 350, height: 200 },
    { id: 'total-payments', x: 370, y: 0, width: 350, height: 200 },
    { id: 'attention-required', x: 0, y: 220, width: 720, height: 420 },
  ];

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
          console.log('Loaded from DB:', data.layouts);
          console.log('Available cards:', dashboardCards.map((c: DashboardCard) => c.id));
          
          if (data.layouts && data.layouts.length > 0) {
            const loadedLayouts = data.layouts
              .filter((l: any) => dashboardCards.some((c: DashboardCard) => c.id === l.card_id))
              .map((l: any) => ({
                id: l.card_id,
                x: l.x,
                y: l.y,
                width: l.width,
                height: l.height,
              }));
            
            console.log('Filtered layouts:', loadedLayouts);
            
            if (loadedLayouts.length > 0) {
              setLayouts(loadedLayouts);
            } else {
              setLayouts(defaultLayouts);
            }
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
          l.id === dragState.cardId 
            ? { ...l, x: Math.max(0, dragState.offsetX + deltaX), y: Math.max(0, dragState.offsetY + deltaY) }
            : l
        ));
      }
      
      if (resizeState.isResizing) {
        const deltaX = e.clientX - resizeState.startX;
        const deltaY = e.clientY - resizeState.startY;
        
        setLayouts(prev => prev.map(l => {
          if (l.id !== resizeState.cardId) return l;
          
          const newLayout = { ...l };
          
          if (resizeState.handle.includes('right')) {
            newLayout.width = Math.max(280, resizeState.startWidth + deltaX);
          }
          if (resizeState.handle.includes('left')) {
            const newWidth = Math.max(280, resizeState.startWidth - deltaX);
            const widthDiff = resizeState.startWidth - newWidth;
            newLayout.width = newWidth;
            newLayout.x = l.x + widthDiff;
          }
          if (resizeState.handle.includes('bottom')) {
            newLayout.height = Math.max(150, resizeState.startHeight + deltaY);
          }
          if (resizeState.handle.includes('top')) {
            const newHeight = Math.max(150, resizeState.startHeight - deltaY);
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

  const handleDragStart = (e: React.MouseEvent, cardId: string) => {
    if (!isEditMode) return;
    
    const layout = layouts.find(l => l.id === cardId);
    if (!layout) return;
    
    setDragState({
      isDragging: true,
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: layout.x,
      offsetY: layout.y,
    });
  };

  const handleResizeStart = (e: React.MouseEvent, cardId: string, handle: string) => {
    if (!isEditMode) return;
    e.stopPropagation();
    
    const layout = layouts.find(l => l.id === cardId);
    if (!layout) return;
    
    setResizeState({
      isResizing: true,
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: layout.width,
      startHeight: layout.height,
      handle,
    });
  };

  return (
    <div style={{ marginBottom: '30px' }}>
      <EditModeToolbar
        isEditMode={isEditMode}
        onToggleEdit={() => setIsEditMode(true)}
        onSave={handleSave}
        onReset={handleReset}
        onCancel={() => setIsEditMode(false)}
      />

      <div ref={containerRef} style={{ position: 'relative', minHeight: '670px' }}>
        {layouts.map((layout) => {
          const card = dashboardCards.find((c: DashboardCard) => c.id === layout.id);
          if (!card) return null;

          return (
            <EditableCard
              key={layout.id}
              layout={layout}
              isEditMode={isEditMode}
              onDragStart={handleDragStart}
              onResizeStart={handleResizeStart}
            >
              {card.component}
            </EditableCard>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard2EditableLayout;