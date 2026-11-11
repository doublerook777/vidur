interface IconProps {
  size?: number;
}

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const, 'aria-hidden': true });

export function IconHome({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

export function IconCustomers({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.6-3.6 3-5.5 5.5-5.5S13.9 16.4 14.5 20" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.5 14.7c2.3.4 4 2.1 4.5 5" />
    </svg>
  );
}

export function IconReminders({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconSettings({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-1.8-3-2.3 1a7 7 0 0 0-2-1.2L14.4 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-1-1.8 3 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 1.8 3 2.3-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3 1 1.8-3-2-1.5A7 7 0 0 0 19 12Z" />
    </svg>
  );
}

export function IconArrowUp({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 20V6" />
      <path d="M6 12l6-6 6 6" />
    </svg>
  );
}

export function IconArrowDown({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 4v14" />
      <path d="M6 12l6 6 6-6" />
    </svg>
  );
}

export function IconNote({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6M9 16h6M9 8h2" />
    </svg>
  );
}

export function IconMic({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function IconBackspace({ size = 28 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M8 5h13a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-6-7 6-7Z" />
      <path d="M12 10l5 5M17 10l-5 5" />
    </svg>
  );
}

export function IconLock({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconCheck({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}

export function IconBack({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
