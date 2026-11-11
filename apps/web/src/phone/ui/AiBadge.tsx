import type { ScreenProps, EmptyVM } from './types.js';
import { LABELS } from './labels.js';

export function AiBadge({ lang }: ScreenProps<EmptyVM>) {
  const t = LABELS[lang];
  return (
    <span class="ai-badge" data-feature="ai-badge" aria-label="AI assistant">
      {t.aiBadge}
    </span>
  );
}
