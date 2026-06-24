import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
 icon: LucideIcon;
 title: string;
 description: string;
 action?: {
 label: string;
 onClick: () => void;
 };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
 icon: Icon,
 title,
 description,
 action
}) => {
 return (
 <div className="text-center py-12 px-4">
 <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 mb-6">
 <Icon className="w-10 h-10 text-content-muted" />
 </div>
 <h3 className="text-xl font-bold text-content-primary mb-2">
 {title}
 </h3>
 <p className="text-content-secondary mb-6 max-w-md mx-auto">
 {description}
 </p>
 {action && (
 <button
 onClick={action.onClick}
 className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
 >
 {action.label}
 </button>
 )}
 </div>
 );
};


