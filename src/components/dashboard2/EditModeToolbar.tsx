import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface EditModeToolbarProps {
  isEditMode: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onReset: () => void;
  onCancel: () => void;
}

const EditModeToolbar = ({ isEditMode, onToggleEdit, onSave, onReset, onCancel }: EditModeToolbarProps) => {
  return (
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
            <Button variant="outline" onClick={onReset}>
              <Icon name="RotateCcw" size={16} className="mr-2" />
              Сбросить
            </Button>
            <Button variant="outline" onClick={onCancel}>
              <Icon name="X" size={16} className="mr-2" />
              Отмена
            </Button>
            <Button onClick={onSave}>
              <Icon name="Save" size={16} className="mr-2" />
              Сохранить
            </Button>
          </>
        ) : (
          <Button onClick={onToggleEdit}>
            <Icon name="Edit" size={16} className="mr-2" />
            Редактировать
          </Button>
        )}
      </div>
    </div>
  );
};

export default EditModeToolbar;
