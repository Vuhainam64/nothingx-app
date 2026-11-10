import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, Minimize2, Maximize2, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/appMeta';
import { isDesktop } from '@/lib/isDesktop';
import { useDeviceStore } from '@/lib/deviceStore';
import { NothingMark } from '@/components/NothingMark';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function TitleBar() {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);
  const desktop = isDesktop();

  const viewMode = useDeviceStore((s) => s.viewMode);
  const closeToTray = useDeviceStore((s) => s.closeToTray);
  const setViewMode = useDeviceStore((s) => s.setViewMode);
  const hideToSystemTray = useDeviceStore((s) => s.hideToSystemTray);

  useEffect(() => {
    if (!desktop) return;
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        setMaximized(await appWindow.isMaximized());
        unlisten = await appWindow.onResized(async () => {
          setMaximized(await appWindow.isMaximized());
        });
      } catch {
        // Running inside standard browser window
      }
    })();

    return () => {
      unlisten?.();
    };
  }, [desktop]);

  const handleMinimize = async () => {
    if (!desktop) {
      setViewMode('mini');
      return;
    }
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().minimize();
  };

  const handleMaximize = async () => {
    if (!desktop) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = async () => {
    if (closeToTray) {
      await hideToSystemTray();
      toast.info(t('tray.hiddenToast'));
      return;
    }
    if (!desktop) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().close();
  };

  const handleToggleMini = () => {
    const next = viewMode === 'mini' ? 'full' : 'mini';
    setViewMode(next);
    if (next === 'mini') {
      toast.success(t('tray.pinnedToast'));
    }
  };

  const handleHideToTray = async () => {
    await hideToSystemTray();
    toast.info(t('tray.hiddenToast'));
  };

  return (
    <div
      data-ui="titlebar"
      data-tauri-drag-region
      className={cn(
        'h-8 shrink-0 select-none flex items-center justify-between pl-3 pr-1',
        'border-b border-border/60 bg-background/85 backdrop-blur-md text-xs text-muted-foreground',
      )}
    >
      <div data-tauri-drag-region className="flex items-center gap-2 min-w-0 flex-1 h-full">
        <NothingMark className="size-3.5 text-primary shrink-0" />
        <span data-tauri-drag-region className="font-ndot tracking-wider text-foreground/90 truncate">
          {APP_NAME}
        </span>
        <span
          data-tauri-drag-region
          className="text-[10px] text-muted-foreground/60 font-mono hidden sm:inline"
        >
          AUDIO SUITE
        </span>
      </div>

      <div className="flex items-center h-full -mr-1">
        {/* Mini Mode & Hide to System Tray Controls (always available) */}
        <WinButton
          label={viewMode === 'mini' ? t('window.fullMode') : t('window.miniMode')}
          onClick={handleToggleMini}
        >
          {viewMode === 'mini' ? (
            <Maximize2 className="size-3.5" />
          ) : (
            <Minimize2 className="size-3.5" />
          )}
        </WinButton>

        <WinButton label={t('window.hideToTray')} onClick={handleHideToTray}>
          <EyeOff className="size-3.5" />
        </WinButton>

        {desktop && (
          <>
            <WinButton label={t('window.minimize')} onClick={handleMinimize}>
              <Minus className="size-3.5" />
            </WinButton>
            <WinButton
              label={maximized ? t('window.restore') : t('window.maximize')}
              onClick={handleMaximize}
            >
              {maximized ? <Copy className="size-3 -scale-x-100" /> : <Square className="size-3" />}
            </WinButton>
            <WinButton label={t('window.close')} onClick={handleClose} variant="close">
              <X className="size-3.5" />
            </WinButton>
          </>
        )}
      </div>
    </div>
  );
}

function WinButton({
  children,
  onClick,
  label,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  variant?: 'default' | 'close';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            'h-8 w-9 inline-flex items-center justify-center transition-colors text-muted-foreground',
            variant === 'default' && 'hover:bg-accent hover:text-foreground',
            variant === 'close' && 'hover:bg-destructive hover:text-white',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
