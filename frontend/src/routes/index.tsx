import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '../pages/home';
import { RoomPage } from '../pages/rooms/room';
import { MyRoomsPage } from '../pages/rooms';
import { ProfilePage } from '../pages/profile';
import { SettingsPage } from '../pages/settings';
import { StudioPage } from '../pages/studio';
import { RoomStudioPage } from '../pages/studio/room';
import { ReportPage } from '../pages/reports';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/rooms" element={<MyRoomsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/studio" element={<StudioPage />} />
      <Route path="/room/:code" element={<RoomPage />} />
      <Route path="/rooms/:code/studio" element={<RoomStudioPage />} />
      <Route path="/report/:id/:roomCode?" element={<ReportPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
