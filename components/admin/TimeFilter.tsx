'use client'

import React from 'react';

interface TimeFilterProps {
  filter: 'D' | 'W' | 'M' | 'Y' | 'A';
  onFilterChange: (filter: 'D' | 'W' | 'M' | 'Y' | 'A') => void;
  options?: ('D' | 'W' | 'M' | 'Y' | 'A')[];
  className?: string;
}

/**
 * TimeFilter Component
 * Reusable filter UI for admin pages (D/W/M/Y/A)
 */
export const TimeFilter = React.memo<TimeFilterProps>(({
  filter,
  onFilterChange,
  options = ['D', 'W', 'M', 'Y', 'A'],
  className = '',
}) => {
  return (
    <div 
      className={className}
      style={{ 
        display: 'flex', 
        background: '#f0f2f5', 
        padding: '4px', 
        borderRadius: '8px', 
        gap: '4px' 
      }}
    >
      {options.map((item) => (
        <button
          key={item}
          onClick={() => onFilterChange(item)}
          style={{
            padding: '6px 14px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            background: filter === item ? '#fff' : 'transparent',
            color: filter === item ? '#007bff' : '#65676b',
            boxShadow: filter === item ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
            transition: '0.2s'
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
});

TimeFilter.displayName = 'TimeFilter';
