import type { Actions, Lang } from '../contract.js';

/** Uniform props for every phone screen and widget: a view model, the action callbacks, and the UI language. */
export interface ScreenProps<VM> {
  vm: VM;
  actions: Actions;
  lang: Lang;
}

/** AiBadge and other static widgets carry no state of their own. */
export type EmptyVM = Record<string, never>;
