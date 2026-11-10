import { cn } from '@/lib/utils';

export function NothingMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-5', className)}
    >
      {/* Dot-matrix Nothing X emblem */}
      <circle cx="6" cy="6" r="2.2" className="fill-current" />
      <circle cx="10" cy="10" r="2.2" className="fill-current" />
      <circle cx="14" cy="14" r="2.4" className="fill-primary" />
      <circle cx="18" cy="18" r="2.2" className="fill-current" />
      <circle cx="22" cy="22" r="2.2" className="fill-current" />
      <circle cx="22" cy="6" r="2.2" className="fill-current" />
      <circle cx="18" cy="10" r="2.2" className="fill-current" />
      <circle cx="10" cy="18" r="2.2" className="fill-current" />
      <circle cx="6" cy="22" r="2.2" className="fill-current" />
    </svg>
  );
}

interface DeviceIllustrationProps {
  accentHex?: string;
  isHeadphone?: boolean;
  className?: string;
}

export function NothingDeviceIllustration({
  accentHex = '#FFFFFF',
  isHeadphone = false,
  className,
}: DeviceIllustrationProps) {
  if (isHeadphone) {
    return (
      <svg
        viewBox="0 0 240 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('w-48 h-40 select-none', className)}
      >
        <defs>
          <radialGradient id="nxGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentHex} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accentHex} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="120" cy="105" r="82" fill="url(#nxGlow)" />
        {/* Headband arch */}
        <path
          d="M56 115V88C56 52.6538 84.6538 24 120 24C155.346 24 184 52.6538 184 88V115"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Left & Right Transparent Ear Cups */}
        <rect
          x="38"
          y="96"
          width="36"
          height="66"
          rx="18"
          fill={accentHex}
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <rect
          x="166"
          y="96"
          width="36"
          height="66"
          rx="18"
          fill={accentHex}
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        {/* Red & White Nothing Recording Indicators */}
        <circle cx="56" cy="129" r="5" className="fill-muted-foreground/60" />
        <circle cx="184" cy="129" r="5" fill="#D71921" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-48 h-40 select-none', className)}
    >
      <defs>
        <radialGradient id="nxEarGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={accentHex} stopOpacity="0.22" />
          <stop offset="100%" stopColor={accentHex} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="100" r="84" fill="url(#nxEarGlow)" />

      {/* Left Earbud */}
      <g transform="translate(46, 36)">
        {/* Stem (Transparent shell) */}
        <rect
          x="18"
          y="46"
          width="24"
          height="78"
          rx="12"
          fill={accentHex}
          fillOpacity="0.14"
          stroke="currentColor"
          strokeOpacity="0.65"
          strokeWidth="2"
        />
        {/* Internal acoustic PCB details */}
        <rect x="25" y="64" width="10" height="28" rx="3" fill="currentColor" fillOpacity="0.22" />
        {/* White Left indicator dot */}
        <circle cx="30" cy="106" r="3.5" fill="#FFFFFF" stroke="currentColor" strokeWidth="1" />
        {/* Acoustic chamber & ear tip */}
        <ellipse
          cx="38"
          cy="36"
          rx="26"
          ry="20"
          fill={accentHex}
          fillOpacity="0.24"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <circle cx="46" cy="36" r="8" fill="currentColor" fillOpacity="0.25" />
      </g>

      {/* Right Earbud */}
      <g transform="translate(122, 36)">
        {/* Stem (Transparent shell) */}
        <rect
          x="30"
          y="46"
          width="24"
          height="78"
          rx="12"
          fill={accentHex}
          fillOpacity="0.14"
          stroke="currentColor"
          strokeOpacity="0.65"
          strokeWidth="2"
        />
        {/* Internal acoustic PCB details */}
        <rect x="37" y="64" width="10" height="28" rx="3" fill="currentColor" fillOpacity="0.22" />
        {/* Iconic Nothing Red Right indicator dot */}
        <circle cx="42" cy="106" r="3.5" fill="#D71921" />
        {/* Acoustic chamber & ear tip */}
        <ellipse
          cx="34"
          cy="36"
          rx="26"
          ry="20"
          fill={accentHex}
          fillOpacity="0.24"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <circle cx="26" cy="36" r="8" fill="currentColor" fillOpacity="0.25" />
      </g>
    </svg>
  );
}
