import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        {/* key={pathname} remounts Outlet on route change, triggering page-enter animation */}
        <main key={location.pathname} className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
