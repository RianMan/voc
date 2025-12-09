import React, { useState, useRef, useEffect } from 'react';
import { ReviewStatus, STATUS_LABELS } from '../types';
import { ChevronDown, Check, Clock, Ban, CheckCircle, Send, Loader, CheckCircle2 } from 'lucide-react';

interface StatusBadgeProps {
  status: ReviewStatus;
  onChange: (newStatus: ReviewStatus) => void;
}

const STATUS_CONFIG: Record<ReviewStatus, { 
  bg: string; 
  text: string; 
  border: string;
  icon: React.ReactNode;
  dotColor: string;
}> = {
  pending: { 
    bg: 'bg-slate-50', 
    text: 'text-slate-600', 
    border: 'border-slate-200',
    icon: <Clock size={12} />,
    dotColor: 'bg-slate-400'
  },
  irrelevant: { 
    bg: 'bg-gray-50', 
    text: 'text-gray-500', 
    border: 'border-gray-200',
    icon: <Ban size={12} />,
    dotColor: 'bg-gray-400'
  },
  confirmed: { 
    bg: 'bg-blue-50', 
    text: 'text-blue-700', 
    border: 'border-blue-200',
    icon: <CheckCircle size={12} />,
    dotColor: 'bg-blue-500'
  },
  reported: { 
    bg: 'bg-purple-50', 
    text: 'text-purple-700', 
    border: 'border-purple-200',
    icon: <Send size={12} />,
    dotColor: 'bg-purple-500'
  },
  in_progress: { 
    bg: 'bg-amber-50', 
    text: 'text-amber-700', 
    border: 'border-amber-200',
    icon: <Loader size={12} />,
    dotColor: 'bg-amber-500'
  },
  resolved: { 
    bg: 'bg-green-50', 
    text: 'text-green-700', 
    border: 'border-green-200',
    icon: <CheckCircle2 size={12} />,
    dotColor: 'bg-green-500'
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentStatus = status || 'pending';
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (newStatus: ReviewStatus) => {
    onChange(newStatus);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 当前状态按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
          border transition-all duration-150 cursor-pointer
          hover:shadow-sm active:scale-95
          ${config.bg} ${config.text} ${config.border}
        `}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
        {STATUS_LABELS[currentStatus]}
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const itemConfig = STATUS_CONFIG[key as ReviewStatus];
            const isSelected = key === currentStatus;
            
            return (
              <button
                key={key}
                onClick={() => handleSelect(key as ReviewStatus)}
                className={`
                  w-full px-3 py-2 text-left text-xs flex items-center gap-2
                  transition-colors hover:bg-slate-50
                  ${isSelected ? 'bg-slate-50' : ''}
                `}
              >
                <span className={`w-2 h-2 rounded-full ${itemConfig.dotColor}`} />
                <span className={`flex-1 ${isSelected ? 'font-medium' : ''}`}>{label}</span>
                {isSelected && <Check size={14} className="text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
