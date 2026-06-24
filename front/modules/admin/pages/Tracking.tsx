import React from 'react';
import { Statistics } from './Statistics';
import { Toast, User } from '../../core/types/types';

interface TrackingProps {
 currentUser?: User | null;
 showToast?: (message: string, type: Toast['type'], duration?: number) => void;
}

export const Tracking: React.FC<TrackingProps> = () => {
 return <Statistics />;
};

