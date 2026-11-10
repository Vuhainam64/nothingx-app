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
    let unlistenMini: (() => void) | undefined;
    let unlistenFull: (() => void) | undefined;
    let unlistenAnc: (() => void) | undefined;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenMini = await listen('tray:open-mini', () => {
          void restoreFromSystemTray('mini');
        });
        unlistenFull = await listen('tray:open-full', () => {
          void restoreFromSystemTray('full');
        });
        unlistenAnc = await listen<AncMode>('tray:anc-mode', (ev) => {
          setAncMode(ev.payload);
        });
      } catch {
        // ignore outside Tauri
      }
    })();

    return () => {
      unlistenMini?.();
      unlistenFull?.();
      unlistenAnc?.();
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
