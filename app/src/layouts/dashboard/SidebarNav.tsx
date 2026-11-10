import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NAV_ITEMS, NAV_SECTIONS } from './nav';

interface SidebarNavProps {
  collapsed: boolean;
  onItemClick?: () => void;
}

// IMPORTANT: Always use a static string className on NavLink (never a function `({ isActive }) => ...`)
// because when `collapsed` is true, `<TooltipTrigger asChild>` (Radix Slot) merges `className` as a string.
const LINK_BASE =
  'group relative flex items-center rounded-lg text-sm font-medium text-muted-foreground transition-all duration-150 outline-none hover:bg-accent/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary/15 aria-[current=page]:text-primary aria-[current=page]:font-semibold aria-[current=page]:shadow-[inset_0_0_0_1px_rgba(215,25,33,0.32)]';

const LINK_EXPANDED = 'h-9 w-full gap-3 px-2.5';
const LINK_COLLAPSED = 'mx-auto size-9 justify-center';

export function SidebarNav({ collapsed, onItemClick }: SidebarNavProps) {
  const { t } = useTranslation();

  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-4">
      {NAV_SECTIONS.map((sec) => {
        const items = NAV_ITEMS.filter((i) => i.section === sec.id);
        return (
          <div key={sec.id} className="flex flex-col gap-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t(sec.labelKey)}
              </div>
            )}
            {items.map((item) => {
              const Icon = item.icon;
              const label = t(item.labelKey);
              const link = (
                <NavLink
                  data-ui="nav-item"
                  to={item.to}
                  onClick={onItemClick}
                  aria-label={collapsed ? label : undefined}
                  className={cn(LINK_BASE, collapsed ? LINK_COLLAPSED : LINK_EXPANDED)}
                >
                  {!collapsed && (
                    <span
                      data-ui="nav-indicator"
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary opacity-0 transition-opacity group-aria-[current=page]:opacity-100"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate flex-1">{label}</span>}
                </NavLink>
              );

              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              ) : (
                <div key={item.to}>{link}</div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
