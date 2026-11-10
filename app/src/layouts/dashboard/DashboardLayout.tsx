import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useSidebar } from '@/hooks/useSidebar';
import { isDesktop } from '@/lib/isDesktop';
import { useDeviceStore } from '@/lib/deviceStore';
import type { AncMode } from '@/lib/bluetoothProtocol';
import { TitleBar } from '@/components/TitleBar';
import { DashboardSidebar } from './DashboardSidebar';
import { Header } from './Header';
import { MiniWidgetView } from './MiniWidgetView';
import { TrayMinimizedBar } from './TrayMinimizedBar';

export function DashboardLayout() {
  const { collapsed, toggle } = useSidebar();
  const viewMode = useDeviceStore((s) => s.viewMode);
  const isMinimizedToTray = useDeviceStore((s) => s.isMinimizedToTray);
  const restoreFromSystemTray = useDeviceStore((s) => s.restoreFromSystemTray);
  const setAncMode = useDeviceStore((s) => s.setAncMode);

  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    const unlisteners: (() => void)[] = [];

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const add = async <T,>(event: string, handler: (payload: T) => void) => {
          const un = await listen<T>(event, (ev) => handler(ev.payload));
          // Effect cleaned up while `listen` was pending (StrictMode / fast remount): drop it now.
          if (cancelled) un();
          else unlisteners.push(un);
        };
        // Tray icon left click: restore in the current view mode.
        await add('tray:restore', () => {
          void restoreFromSystemTray();
        });
        await add('tray:open-mini', () => {
          void restoreFromSystemTray('mini');
        });
        await add('tray:open-full', () => {
          void restoreFromSystemTray('full');
        });
        await add<AncMode>('tray:anc-mode', (mode) => {
          setAncMode(mode);
        });
      } catch {
        // ignore outside Tauri
      }
    })();

    return () => {
      cancelled = true;
      for (const un of unlisteners.splice(0)) un();
    };
  }, [restoreFromSystemTray, setAncMode]);

  if (isMinimizedToTray) {
    return <TrayMinimizedBar />;
  }

  if (viewMode === 'mini') {
    return <MiniWidgetView />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground">
      <TitleBar />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <DashboardSidebar collapsed={collapsed} onToggle={toggle} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main id="dash-main" data-ui="main" className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
