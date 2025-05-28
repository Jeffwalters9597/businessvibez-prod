import { useDraggable } from '@dnd-kit/core';
import { twMerge } from 'tailwind-merge';

interface DraggableTextProps {
  id: string;
  content: string;
  position: { x: number; y: number };
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  isSelected?: boolean;
  onClick?: () => void;
}

const DraggableText = ({
  id,
  content,
  position,
  fontSize,
  color,
  align,
  isSelected,
  onClick
}: DraggableTextProps) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { type: 'text' }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        fontSize: `${fontSize}px`,
        color,
        textAlign: align,
        cursor: 'move',
        userSelect: 'none',
        width: '80%',
        textShadow: '0px 1px 2px rgba(0,0,0,0.3)',
      }}
      className={twMerge(
        'p-2 rounded transition-all',
        isSelected && 'ring-2 ring-primary-500'
      )}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      {content || 'Double click to edit'}
    </div>
  );
};

export default DraggableText;