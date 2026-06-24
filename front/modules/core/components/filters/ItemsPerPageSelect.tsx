import React from 'react';

export interface ItemsPerPageSelectProps {
 value: number;
 onChange: (value: number) => void;
 options?: number[];
 size?: 'compact' | 'md';
 label?: string;
 className?: string;
 selectClassName?: string;
}

export const ItemsPerPageSelect: React.FC<ItemsPerPageSelectProps> = ({
 value,
 onChange,
 options = [10, 25, 50, 100],
 size = 'md',
 label = 'Itens por página:',
 className = '',
 selectClassName = '',
}) => {
 const isCompact = size === 'compact';

 return (
 <div className={['flex items-center gap-2', className].join(' ')}>
 {label && (
 <span className={`${isCompact ? 'text-[10px] sm:text-xs' : 'text-sm'} text-content-muted`}>
 {label}
 </span>
 )}
 <select
 value={value}
 onChange={(e) => onChange(Number(e.target.value))}
 className={[
 'bg-surface-raised border border-border-default text-content-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500',
 isCompact ? 'px-3 py-2 text-sm' : 'px-3 py-2 text-sm',
 selectClassName,
 ].join(' ')}
 aria-label={label || 'Itens por página'}
 >
 {options.map((opt) => (
 <option key={opt} value={opt}>
 {opt}
 </option>
 ))}
 </select>
 </div>
 );
};
