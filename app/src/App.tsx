import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/lib/theme';
import { DashboardLayout } from '@/layouts/dashboard/DashboardLayout';
import { OverviewPage } from '@/pages/overview/OverviewPage';
import { NoiseControlPage } from '@/pages/anc/NoiseControlPage';
import { EqualizerPage } from '@/pages/equalizer/EqualizerPage';
import { ControlsPage } from '@/pages/controls/ControlsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={150}>
        <BrowserRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route index element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/anc" element={<NoiseControlPage />} />
              <Route path="/equalizer" element={<EqualizerPage />} />
              <Route path="/controls" element={<ControlsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Route>
          </Routes>
          <Toaster position="bottom-right" richColors />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}
