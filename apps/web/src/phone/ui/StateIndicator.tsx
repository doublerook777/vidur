import type { Phase } from '../contract.js';
import type { ScreenProps } from './types.js';
import { LABELS, PHASE_LABEL_KEY } from './labels.js';

export interface StateIndicatorVM {
  phase: Phase;
}

const GLYPHS: Record<Phase, string> = {
  idle: '●',
  listening: '◉',
  thinking: '…',
  speaking: '🔊',
  needs_answer: '?',
  offline: '✕',
};

export function StateIndicator({ vm, lang }: ScreenProps<StateIndicatorVM>) {
  const t = LABELS[lang];
  const label = t[PHASE_LABEL_KEY[vm.phase]];
  return (
    <div
      class={`state-indicator state-${vm.phase}`}
      data-feature="state-indicator"
      role="status"
      aria-live="polite"
    >
      <span class="state-glyph" aria-hidden="true">
        {GLYPHS[vm.phase]}
      </span>
      <span class="state-label">{label}</span>
    </div>
  );
}
