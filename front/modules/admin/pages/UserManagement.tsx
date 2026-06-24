import React from 'react';
import { User } from '../../core/types/types';
import { Toast } from '../../core/components/ui/Toast';
import { Users as UsersPage } from './Users';

interface UserManagementProps {
 currentUser: User | null;
 showToast: (message: string, type: Toast['type'], duration?: number) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser, showToast }) => {
 return currentUser ? <UsersPage currentUser={currentUser} showToast={showToast} /> : null;
};

