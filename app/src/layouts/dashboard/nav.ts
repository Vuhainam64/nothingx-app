import {
  Headphones,
  ShieldAlert,
  Sliders,
  Touchpad,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  section?: 'device' | 'sound' | 'personalize';
}

export const NAV_SECTIONS: { id: NonNullable<NavItem['section']>; labelKey: string }[] = [
  { id: 'device', labelKey: 'nav.sections.device' },
  { id: 'sound', labelKey: 'nav.sections.sound' },
  { id: 'personalize', labelKey: 'nav.sections.personalize' },
];

export const NAV_ITEMS: NavItem[] = [
  { to: '/overview', labelKey: 'nav.overview', icon: Headphones, section: 'device' },
  { to: '/anc', labelKey: 'nav.anc', icon: ShieldAlert, section: 'sound' },
  { to: '/equalizer', labelKey: 'nav.equalizer', icon: Sliders, section: 'sound' },
  { to: '/controls', labelKey: 'nav.controls', icon: Touchpad, section: 'personalize' },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, section: 'personalize' },
];
