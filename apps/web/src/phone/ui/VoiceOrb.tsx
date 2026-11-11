import { useEffect, useRef } from 'preact/hooks';

import type { Phase } from '../contract.js';
import { micLevel, speakerLevel } from '../audio/levels.js';
import { IconMic } from './icons.js';
import { LABELS } from './labels.js';
import type { ScreenProps } from './types.js';

export interface VoiceOrbVM {
  phase: Phase;
}

const BARS = 28;

/**
 * The AI voice circle, and the hold-to-talk button. It moves with the real loudness of the voice in the room
 * while the shopkeeper speaks and of Vidur's voice while it answers; each state also has its own shape,
 * so nothing depends on colour or on seeing the motion.
 */
export function VoiceOrb({ vm, actions, lang }: ScreenProps<VoiceOrbVM>) {
  const t = LABELS[lang];
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || (vm.phase !== 'listening' && vm.phase !== 'speaking')) {
      el.style.setProperty('--lvl', '0');
      return;
    }
    let raf = 0;
    let smooth = 0;
    const tick = (): void => {
      const target = vm.phase === 'listening' ? micLevel() : speakerLevel();
      smooth += (target - smooth) * 0.35;
      el.style.setProperty('--lvl', smooth.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vm.phase]);

  return (
    <button
      ref={ref}
      type="button"
      class={`orb orb-${vm.phase}`}
      data-feature="mic-button"
      aria-label={t.holdToTalk}
      onPointerDown={() => actions.micDown()}
      onPointerUp={() => actions.micUp()}
      onPointerCancel={() => actions.micUp()}
      onPointerLeave={() => actions.micUp()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === ' ' && !e.repeat) {
          e.preventDefault();
          actions.micDown();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          actions.micUp();
        }
      }}
    >
      <svg class="orb-art" viewBox="-64 -64 128 128" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="orbFill" cx="38%" cy="32%" r="78%">
            <stop offset="0%" style="stop-color: var(--orb-hi)" />
            <stop offset="62%" style="stop-color: var(--orb-mid)" />
            <stop offset="100%" style="stop-color: var(--orb-lo)" />
          </radialGradient>
        </defs>
        <circle class="orb-ring orb-ring-3" r="38" />
        <circle class="orb-ring orb-ring-2" r="38" />
        <circle class="orb-ring orb-ring-1" r="38" />
        <g class="orb-bars">
          {Array.from({ length: BARS }, (_, i) => (
            <g key={i} style={`rotate: ${(i * 360) / BARS}deg`}>
              <line class="orb-bar" x1="0" y1="-43" x2="0" y2="-55" style={`--i: ${i}`} />
            </g>
          ))}
        </g>
        <circle class="orb-core" r="36" fill="url(#orbFill)" />
        <circle class="orb-think" r="43" pathLength="100" />
      </svg>
      <span class="orb-glyph">
        <IconMic size={30} />
      </span>
    </button>
  );
}
