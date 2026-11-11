import type { Actions, Lang, ToastVM } from '../contract.js';
import { IconCheck } from './icons.js';

/** A short message above the nav with one button to take the action back. It goes away by itself. */
export function Toast({ vm, actions }: { vm: ToastVM; actions: Actions; lang: Lang }) {
  return (
    <div class="toast" role="status" aria-live="polite">
      <span class="toast-icon" aria-hidden="true"><IconCheck size={18} /></span>
      <span class="toast-text">{vm.text}</span>
      <button type="button" class="toast-action" onClick={() => actions.restoreEntry(vm.restoreToken)}>
        {vm.actionLabel}
      </button>
    </div>
  );
}
