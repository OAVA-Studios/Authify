import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Layout } from '@/components/layout';
import LoginPage from '@/pages/login';
import DashboardPage from '@/pages/dashboard';
import UsersPage from '@/pages/users';
import LicensingPage from '@/pages/licensing';
import DatabasePage from '@/pages/database';
import StoragePage from '@/pages/storage';
import FunctionsPage from '@/pages/functions';
import MessagingPage from '@/pages/messaging';
import WebhooksPage from '@/pages/webhooks';
import RealtimePage from '@/pages/realtime';
import SettingsPage from '@/pages/settings';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="licensing" element={<LicensingPage />} />
          <Route path="database" element={<DatabasePage />} />
          <Route path="storage" element={<StoragePage />} />
          <Route path="functions" element={<FunctionsPage />} />
          <Route path="messaging" element={<MessagingPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="realtime" element={<RealtimePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
