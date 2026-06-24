import React from 'react';

export interface SelectOption<T extends string> {
 value: T;
 label: string;
}

export interface SelectFilterProps<T extends string> {
 value: T;
 onChange: (value: T) => void;
 options: Array<SelectOption<T>>;
 size?: 'compact' | 'md';
 className?: string;
 selectClassName?: string;
 ariaLabel?: string;
 placeholder?: string;
}

export const SelectFilter = <T extends string>({
 value,
 onChange,
 options,
 size = 'compact',
 className = '',
 selectClassName = '',
 ariaLabel = 'Filtrar por',
}: SelectFilterProps<T>) => {
 const isCompact = size === 'compact';

 return (
 <div className={className}>
 <select
 value={value}
 onChange={(e) => onChange(e.target.value as T)}
 aria-label={ariaLabel}
 className={[
 'border border-border-default bg-surface-raised text-content-primary',
 'rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500',
 isCompact ? 'px-3 py-2 text-sm' : 'px-3 py-2 text-sm',
 selectClassName,
 ].join(' ')}
 >
 {options.map((opt) => (
 <option key={opt.value} value={opt.value}>
 {opt.label}
 </option>
 ))}
 </select>
 </div>
 );
};
