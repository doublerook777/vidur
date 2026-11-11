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

export function IconPlus({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconMore({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  );
}

export function IconTrash({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconX({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconHistory({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5" />
      <path d="M4 4v4.5h4.5M12 8v4l3 2" />
    </svg>
  );
}

export function IconChevron({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** One drawn mark per phase, so the state never depends on colour or a text glyph. */
export function IconPhase({ phase, size = 18 }: { phase: 'idle' | 'listening' | 'thinking' | 'speaking' | 'needs_answer' | 'offline'; size?: number }) {
  switch (phase) {
    case 'idle':
      return <svg {...base(size)}><circle cx="12" cy="12" r="5" /></svg>;
    case 'listening':
      return <svg {...base(size)}><circle cx="12" cy="12" r="3" fill="currentColor" /><circle cx="12" cy="12" r="7" /><path d="M12 1.5v0" /></svg>;
    case 'thinking':
      return <svg {...base(size)}><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></svg>;
    case 'speaking':
      return <svg {...base(size)}><path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2" /></svg>;
    case 'needs_answer':
      return <svg {...base(size)}><path d="M9 9a3 3 0 1 1 4.4 2.6c-1 .6-1.4 1.1-1.4 2.4" /><circle cx="12" cy="18" r=".6" fill="currentColor" /></svg>;
    case 'offline':
      return <svg {...base(size)}><path d="M3 3l18 18M8.5 8.5A8 8 0 0 0 4 12m4 3a5 5 0 0 1 3.6-2.9M14 6.2A8 8 0 0 1 20 12m-4 3a5 5 0 0 0-1-1" /><circle cx="12" cy="19" r=".6" fill="currentColor" /></svg>;
  }
}
