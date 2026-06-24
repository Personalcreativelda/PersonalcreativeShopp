import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
 value: number;
 onChange?: (value: number) => void;
 size?: 'sm' | 'md' | 'lg';
 count?: number;
 showCount?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
 value,
 onChange,
 size = 'sm',
 count,
 showCount = false,
}) => {
 const sizeClass = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-7 h-7' }[size];
 const interactive = !!onChange;

 return (
 <div className="flex items-center gap-0.5">
 {[1, 2, 3, 4, 5].map((star) =>
 interactive ? (
 <button
 key={star}
 type="button"
 onClick={() => onChange?.(star)}
 className="p-0 border-0 bg-transparent leading-none cursor-pointer hover:scale-110 transition-transform"
 aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
 >
 <Star
 className={`${sizeClass} transition-colors ${
 star <= Math.round(value)
 ? 'fill-yellow-400 text-yellow-400'
 : 'fill-gray-200 text-content-muted dark:fill-gray-600 dark:text-content-secondary'
 }`}
 />
 </button>
 ) : (
 <span key={star} className="leading-none inline-flex">
 <Star
 className={`${sizeClass} transition-colors ${
 star <= Math.round(value)
 ? 'fill-yellow-400 text-yellow-400'
 : 'fill-gray-200 text-content-muted dark:fill-gray-600 dark:text-content-secondary'
 }`}
 />
 </span>
 )
 )}
 {showCount && count !== undefined && (
 <span className="text-xs text-content-muted ml-1">({count})</span>
 )}
 </div>
 );
};
