import { Card } from '@/components/ui/card';

interface CardLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EditableCardProps {
  layout: CardLayout;
  isEditMode: boolean;
  children: React.ReactNode;
  onDragStart: (e: React.MouseEvent, cardId: string) => void;
  onResizeStart: (e: React.MouseEvent, cardId: string, handle: string) => void;
}

const EditableCard = ({ layout, isEditMode, children, onDragStart, onResizeStart }: EditableCardProps) => {
  const renderResizeHandles = () => {
    if (!isEditMode) return null;
    
    const handleStyle = {
      position: 'absolute' as const,
      background: '#7551e9',
      zIndex: 10,
    };
    
    return (
      <>
        <div style={{ ...handleStyle, top: 0, left: 0, width: '10px', height: '10px', cursor: 'nwse-resize' }} 
             onMouseDown={(e) => onResizeStart(e, layout.id, 'top-left')} />
        <div style={{ ...handleStyle, top: 0, right: 0, width: '10px', height: '10px', cursor: 'nesw-resize' }} 
             onMouseDown={(e) => onResizeStart(e, layout.id, 'top-right')} />
        <div style={{ ...handleStyle, bottom: 0, left: 0, width: '10px', height: '10px', cursor: 'nesw-resize' }} 
             onMouseDown={(e) => onResizeStart(e, layout.id, 'bottom-left')} />
        <div style={{ ...handleStyle, bottom: 0, right: 0, width: '10px', height: '10px', cursor: 'nwse-resize' }} 
             onMouseDown={(e) => onResizeStart(e, layout.id, 'bottom-right')} />
        <div style={{ ...handleStyle, top: 0, left: '50%', transform: 'translateX(-50%)', width: '40px', height: '6px', cursor: 'ns-resize' }} 
             onMouseDown={(e) => onResizeStart(e, layout.id, 'top')} />
        <div style={{ ...handleStyle, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '40px', height: '6px', cursor: 'ns-resize' }} 
             onMouseDown={(e) => onResizeStart(e, layout.id, 'bottom')} />
        <div style={{ ...handleStyle, left: 0, top: '50%', transform: 'translateY(-50%)', width: '6px', height: '40px', cursor: 'ew-resize' }} 
             onMouseDown={(e) => onResizeStart(e, layout.id, 'left')} />
        <div style={{ ...handleStyle, right: 0, top: '50%', transform: 'translateY(-50%)', width: '6px', height: '40px', cursor: 'ew-resize' }} 
             onMouseDown={(e) => onResizeStart(e, layout.id, 'right')} />
      </>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
        cursor: isEditMode ? 'move' : 'default',
      }}
      onMouseDown={(e) => onDragStart(e, layout.id)}
    >
      <Card style={{
        border: isEditMode ? '2px dashed rgba(117, 81, 233, 0.5)' : 'none',
        borderRadius: '16px',
        height: '100%',
        overflow: 'auto',
        userSelect: 'none',
        pointerEvents: isEditMode ? 'none' : 'auto',
      }}>
        {children}
      </Card>
      {renderResizeHandles()}
    </div>
  );
};

export default EditableCard;
