import React from 'react';

interface LoadingSkeletonProps {
 type?: 'card' | 'text' | 'avatar' | 'stats';
 count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ type = 'card', count = 1 }) => {
 if (type === 'card') {
 return (
 <>
 {Array.from({ length: count }).map((_, i) => (
 <div key={i} className="bg-surface-raised rounded-xl shadow p-6 animate-pulse">
 <div className="h-4 bg-surface-base rounded w-3/4 mb-4"></div>
 <div className="h-8 bg-surface-base rounded w-1/2"></div>
 </div>
 ))}
 </>
 );
 }

 if (type === 'stats') {
 return (
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 {Array.from({ length: count || 4 }).map((_, i) => (
 <div key={i} className="bg-surface-raised rounded-2xl shadow-lg p-6 animate-pulse">
 <div className="flex items-start justify-between mb-4">
 <div className="w-12 h-12 bg-surface-base rounded-xl"></div>
 </div>
 <div className="h-4 bg-surface-base rounded w-2/3 mb-2"></div>
 <div className="h-8 bg-surface-base rounded w-1/2"></div>
 </div>
 ))}
 </div>
 );
 }

 if (type === 'avatar') {
 return (
 <div className="animate-pulse">
 <div className="w-16 h-16 bg-surface-base rounded-full"></div>
 </div>
 );
 }

 return (
 <div className="animate-pulse space-y-2">
 {Array.from({ length: count }).map((_, i) => (
 <div key={i} className="h-4 bg-surface-base rounded" style={{ width: `${Math.random() * 40 + 60}%` }}></div>
 ))}
 </div>
 );
};


