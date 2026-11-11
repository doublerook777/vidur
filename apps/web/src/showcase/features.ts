/**
 * One entry per interactive element in the phone app (data-feature="<id>").
 * Plain words. No hype, no claims we cannot back.
 */
import type { FeatureId } from '../phone/contract.js';

export interface FeatureExplanation {
  title: string;
  /** What it does, in one sentence. */
  what: string;
  /** Why it helps a small-shop owner, in one sentence. */
  why: string;
}

export const FEATURES: Record<FeatureId, FeatureExplanation> = {
  'mic-button': {
    title: 'Voice circle',
    what: 'Hold the circle and speak the entry; it moves with your voice while you talk and with Vidur’s voice while it answers, and it only listens while you hold it.',
    why: 'A mid-sale shopkeeper has both hands full, and a circle that moves is the proof that someone is listening.',
  },
  'ai-badge': {
    title: 'AI disclosure badge',
    what: 'Shows, from the first turn, that you are speaking to an AI assistant and not a person.',
    why: 'Your customers and you always know who — or what — is keeping the khata.',
  },
  'totals': {
    title: 'Today’s totals',
    what: 'Shows how much credit went out, how much came in, and how many people were involved today.',
    why: 'You can see the shape of the day’s business at a glance, without adding anything up.',
  },
  'feed': {
    title: 'Entry feed',
    what: 'Lists recent entries — credit, payment, or note — newest first, each with its amount and the date and time it happened.',
    why: 'You can check what was just saved without opening any customer, which catches mistakes early.',
  },
  'entry-card': {
    title: 'Entry card',
    what: 'Shows what Vidur heard and what it saved, and asks a short question when something is unclear.',
    why: 'You never have to trust a hidden guess — you see the amount before and after it is saved.',
  },
  'undo': {
    title: 'Voice undo',
    what: 'Reverses the last entry for 10 seconds after saving — say “nahi, 430” to fix the amount or “galat” to remove it.',
    why: 'Mishearing happens, and fixing it aloud is quicker than finding an edit screen.',
  },
  'customer-list': {
    title: 'Customer list',
    what: 'Lists all customers with their outstanding balances, searchable and sortable.',
    why: 'You can find “Sunita ka baaki” in seconds instead of flipping through the paper khata.',
  },
  'customer-detail': {
    title: 'Customer detail',
    what: 'Shows one customer’s entries, notes and current balance, with the same one-tap undo.',
    why: 'When a customer asks “mera kitna baaki hai”, you can answer from the screen or by voice.',
  },
  'balance': {
    title: 'Balance',
    what: 'Shows the running amount a customer owes, in integer rupees and paise, computed from every entry.',
    why: 'Both you and the customer see the same number, which avoids arguments at the counter.',
  },
  'reminder-gate': {
    title: 'Reminder gate',
    what: 'Blocks any reminder unless the customer has opted in, and allows at most one per customer per 7 days.',
    why: 'It keeps your reminders polite and legal to send — no chasing, no embarrassment for regulars.',
  },
  'consent-toggle': {
    title: 'Consent toggle',
    what: 'Records whether a customer agreed to receive reminders from you.',
    why: 'You stay on the right side of your customers’ trust and the rules around messaging.',
  },
  'language-switch': {
    title: 'Language switch',
    what: 'Changes the app and the spoken replies between Hindi, English and Kannada.',
    why: 'The shop runs in the language you actually speak, including code-mixed sentences.',
  },
  'theme-switch': {
    title: 'Theme switch',
    what: 'Switches the app between light and dark display modes.',
    why: 'A bright shop needs a dark screen, and a dark shop needs a light one — readability decides.',
  },
  'delete-all': {
    title: 'Delete all data',
    what: 'Erases every entry, customer and note from the phone, permanently.',
    why: 'Your shop’s records are yours — you can wipe them when you sell, reset, or leave.',
  },
  'keypad': {
    title: 'Keypad entry',
    what: 'Lets you add an entry by hand: choose credit or payment, the customer, the amount, and when it happened.',
    why: 'The khata never stops working just because the network or the microphone does, and you can put in something from yesterday.',
  },
  'offline-banner': {
    title: 'Offline banner',
    what: 'Tells you when the network is down and speech is unavailable right now.',
    why: 'You know immediately why voice stopped working, and you can switch to the keypad.',
  },
  'onboarding-disclosure': {
    title: 'Onboarding disclosure',
    what: 'Explains, before the first use, that Vidur is an AI assistant, how it works, and what it stores.',
    why: 'You agree with full knowledge — no hidden data collection, no surprises later.',
  },
  'encrypted-badge': {
    title: 'Encrypted badge',
    what: 'Indicates the on-device ledger is stored encrypted on the phone.',
    why: 'If the phone is lost, your customers’ dues are not readable by whoever finds it.',
  },
  'disambiguation': {
    title: 'Same-name disambiguation',
    what: 'Asks “Kaun se Ramesh?” with the aliases when two customers share a name, before saving anything.',
    why: 'Entries land on the right Ramesh every time, instead of corrupting the wrong account.',
  },
  'confirm-amount': {
    title: 'Amount confirmation',
    what: 'Re-asks just the amount when the heard number is low confidence, before anything is saved.',
    why: 'A wrong amount is the one mistake that costs real money, so it never gets saved silently.',
  },
  'state-indicator': {
    title: 'State indicator',
    what: 'Shows whether Vidur is idle, listening, thinking, speaking, waiting for your answer, or offline.',
    why: 'You always know whether it heard you — no talking into a dead microphone.',
  },
  'timestamp': {
    title: 'Date and time',
    what: 'Every entry shows when the money moved, and says when it was recorded if that was on a different day.',
    why: 'You can settle a “maine kal diya tha” argument by looking at the entry, not by trusting memory.',
  },
  'add-entry': {
    title: 'Add entry by hand',
    what: 'Opens a form to add an entry without speaking: type, customer, amount and when.',
    why: 'Some entries are easier to type, and some places are too loud for the mic.',
  },
  'remove-entry': {
    title: 'Remove an entry',
    what: 'The three dots on an entry let you remove it after asking once, and a removal can be taken back for a few seconds.',
    why: 'A wrong entry should be easy to take out, but never by accident.',
  },
  'answer-buttons': {
    title: 'Yes and No buttons',
    what: 'When Vidur asks a yes-or-no question, such as whether to create a new khata for a new name, you can tap the answer instead of saying it.',
    why: 'A new name is never created until you say yes, and in a noisy shop tapping is surer than speaking.',
  },
  'history': {
    title: 'All entries',
    what: 'Opens every entry, grouped by day, newest first, with the same remove option.',
    why: 'You can look back at last week without opening each customer.',
  },
};
