import React from 'react';
import { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level }) => {
  const getStyles = (lvl: RiskLevel) => {
    switch (lvl) {
      case 'High':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'Low':
        return 'bg-green-100 text-green-800 border border-green-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStyles(level)}`}>
      {level.toUpperCase()}
    </span>
  );
};