import { Navigate, Route, Routes } from 'react-router-dom';
import { App } from './App';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App mode="home" />} />
      <Route path="/room/:code" element={<App mode="room" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
