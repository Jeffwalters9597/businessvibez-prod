import React, { useState } from 'react';

interface DebugPanelProps {
  messages: string[];
  title?: string;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ 
  messages, 
  title = "Debug Info" 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible || messages.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-black bg-opacity-80 text-white rounded-lg shadow-lg overflow-hidden">
      <div 
        className="p-2 flex justify-between items-center cursor-pointer border-b border-gray-700"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-semibold">{title} ({messages.length})</h3>
        <div className="flex space-x-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setVisible(false);
            }}
            className="text-xs px-2 py-1 bg-red-700 rounded hover:bg-red-600"
          >
            Close
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="max-h-96 overflow-y-auto p-2">
          <ul className="text-xs space-y-1">
            {messages.map((msg, i) => (
              <li key={i} className="border-b border-gray-700 pb-1 break-words">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;