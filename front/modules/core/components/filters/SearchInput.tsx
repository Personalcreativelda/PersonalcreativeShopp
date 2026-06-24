import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps {
 value: string;
 onChange: (value: string) => void;
 placeholder?: string;
 className?: string;
 inputClassName?: string;
 size?: 'compact' | 'md';
 showClearButton?: boolean;
 onClear?: () => void;
 ariaLabel?: string;
 autoFocus?: boolean;
 debounceMs?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
 value,
 onChange,
 placeholder = 'Pesquisar...',
 className = '',
 inputClassName = '',
 size = 'md',
 showClearButton = true,
 onClear,
 ariaLabel,
 autoFocus = false,
 debounceMs,
}) => {
 const [internalValue, setInternalValue] = React.useState(value);

 React.useEffect(() => {
 setInternalValue(value);
 }, [value]);

 React.useEffect(() => {
 if (!debounceMs) return;
 const id = window.setTimeout(() => onChange(internalValue), debounceMs);
 return () => window.clearTimeout(id);
 }, [debounceMs, internalValue, onChange]);

 const effectiveValue = debounceMs ? internalValue : value;

 const handleChange = (next: string) => {
 if (debounceMs) {
 setInternalValue(next);
 return;
 }
 onChange(next);
 };

 const handleClear = () => {
 if (debounceMs) setInternalValue('');
 onChange('');
 onClear?.();
 };

 const isCompact = size === 'compact';

 return (
 <div className={`relative ${className}`}>
 <Search
 className={`absolute left-3 top-1/2 -translate-y-1/2 text-content-muted ${isCompact ? 'w-4 h-4' : 'w-4 h-4'}`}
 />
 <input
 type="text"
 value={effectiveValue}
 onChange={(e) => handleChange(e.target.value)}
 placeholder={placeholder}
 autoFocus={autoFocus}
 aria-label={ariaLabel || placeholder}
 className={[
 'w-full border border-border-strong rounded bg-surface-raised text-content-primary',
 // compact (toolbar) deve alinhar com o PeriodFilter: mesma altura e sensaçéo visual
 isCompact ? 'pl-10 pr-10 py-2 text-sm rounded-lg focus:ring-2' : 'pl-10 pr-10 py-2 text-sm focus:ring-2',
 'focus:ring-brand-500 focus:outline-none',
 inputClassName,
 ].join(' ')}
 />

 {showClearButton && effectiveValue && (
 <button
 type="button"
 onClick={handleClear}
 className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary ${
 isCompact ? 'p-1' : 'p-1'
 }`}
 aria-label="Limpar pesquisa"
 title="Limpar"
 >
 <X className={isCompact ? 'w-4 h-4' : 'w-4 h-4'} />
 </button>
 )}
 </div>
 );
};



