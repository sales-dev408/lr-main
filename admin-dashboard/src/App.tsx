import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { CardsPage } from './pages/CardsPage';
import { ContentPage } from './pages/ContentPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { ThemePage } from './pages/ThemePage';
import { TicketsPage } from './pages/TicketsPage';
import { VendorsPage } from './pages/VendorsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<OverviewPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/content" element={<ContentPage />} />
        <Route path="/theme" element={<ThemePage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
