import { Navigate, Route, Routes } from 'react-router-dom';
import { App } from './App';
import { MyRoomsPage, ProfilePage, SettingsPage } from './features/dashboard/DashboardPages';
import { ReportPage } from './features/report/ReportPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App mode="home" />} />
      <Route path="/rooms" element={<MyRoomsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/room/:code" element={<App mode="room" />} />
      <Route path="/report/:id" element={<ReportPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
