import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../../modules/core/components/layout/Layout';
import { User } from '../../modules/core/types/types';
import { getActivePageFromPath, getAdminPath } from '../../modules/core/routes/adminRoutes';

interface AdminLayoutProps {
  currentUser: User;
  isDarkMode: boolean;
  toggleTheme: () => void;
  onLogout: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentUser,
  isDarkMode,
  toggleTheme,
  onLogout
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleNavigate = (page: string) => {
    const route = getAdminPath(page);
    navigate(route);
  };
  
  return (
    <Layout
      currentUser={currentUser}
      activePage={getActivePageFromPath(location.pathname)}
      onNavigate={handleNavigate}
      onLogout={onLogout}
      isDarkMode={isDarkMode}
      toggleTheme={toggleTheme}
    >
      <Outlet />
    </Layout>
  );
};
