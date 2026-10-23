function Icon({ size = 16, strokeWidth = 2, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ChipIcon({ size = 18 }) {
  return (
    <Icon size={size} strokeWidth={1.8}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
    </Icon>
  );
}

export function LogoMarkIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="26" height="26" rx="5" strokeWidth="2" />
      <g clipPath="url(#logo-mark-clip)">
        <path
          d="M14.0002 19.3338V20.6672M14.0002 19.3338H17.3338M14.0002 19.3338H10.6666M14.0002 7.33282V8.66626M14.0002 8.66626H10.6666M14.0002 8.66626H17.3338M17.3338 19.3338V20.6672M17.3338 19.3338H18.0005C18.737 19.3338 19.334 18.7368 19.334 18.0003V17.3336M17.3338 7.33282V8.66626M17.3338 8.66626H18.0005C18.737 8.66626 19.334 9.26327 19.334 9.9997V10.6664M7.33301 14H8.66645M8.66645 14V17.3336M8.66645 14V10.6664M7.33301 17.3336H8.66645M8.66645 17.3336V18.0003C8.66645 18.7368 9.26345 19.3338 9.99989 19.3338H10.6666M7.33301 10.6664H8.66645M8.66645 10.6664V9.9997C8.66645 9.26327 9.26345 8.66626 9.99989 8.66626H10.6666M19.334 14H20.6674M19.334 14V10.6664M19.334 14V17.3336M19.334 17.3336H20.6674M19.334 10.6664H20.6674M10.6666 19.3338V20.6672M10.6666 7.33282V8.66626M12 11.3331H16.0004C16.3686 11.3331 16.6671 11.6316 16.6671 11.9999V16.0002C16.6671 16.3684 16.3686 16.6669 16.0004 16.6669H12C11.6318 16.6669 11.3333 16.3684 11.3333 16.0002V11.9999C11.3333 11.6316 11.6318 11.3331 12 11.3331Z"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <defs>
        <clipPath id="logo-mark-clip">
          <rect width="16" height="16" fill="white" transform="translate(6 6)" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function CheckIcon({ size = 14 }) {
  return (
    <Icon size={size} strokeWidth={3}>
      <polyline points="20 6 9 17 4 12" />
    </Icon>
  );
}

export function CubeIcon({ size = 16 }) {
  return (
    <Icon size={size} strokeWidth={1.8}>
      <path d="M12 2 3 7v10l9 5 9-5V7z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </Icon>
  );
}

export function CodeIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </Icon>
  );
}

export function ClockIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </Icon>
  );
}

export function PlusIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function XIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  );
}

export function LockIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  );
}

export function CopyIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </Icon>
  );
}

export function DownloadIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </Icon>
  );
}

export function ShareIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.6 15.4 6.4M8.6 13.4l6.8 4.2" />
    </Icon>
  );
}

export function UndoIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-1" />
    </Icon>
  );
}

export function ChevronRightIcon({ size = 14 }) {
  return (
    <Icon size={size} strokeWidth={2.4}>
      <polyline points="9 6 15 12 9 18" />
    </Icon>
  );
}

export function AlertTriangleIcon({ size = 16 }) {
  return (
    <Icon size={size} strokeWidth={2}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Icon>
  );
}

export function LightbulbIcon({ size = 16 }) {
  return (
    <Icon size={size} strokeWidth={1.8}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.05V17h6v-.25c0-.85.4-1.55 1-2.05A7 7 0 0 0 12 2Z" />
    </Icon>
  );
}

export function ShieldAlertIcon({ size = 16 }) {
  return (
    <Icon size={size} strokeWidth={1.8}>
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </Icon>
  );
}

export function TrashIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Icon>
  );
}

export function SearchIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Icon>
  );
}

