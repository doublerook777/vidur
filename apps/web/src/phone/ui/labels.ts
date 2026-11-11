import type { Lang, Phase } from '../contract.js';

/**
 * Every visible string in the phone UI, in English, Hindi (Devanagari) and Kannada.
 * Keep wording short and plain. Kannada words we are unsure about are the simplest
 * common ones and their keys are listed in KN_REVIEW for a native speaker to check.
 */
export const KN_REVIEW: readonly string[] = [
  'phaseThinking',
  'phaseNeedsAnswer',
  'mockMode',
  'reminderTooSoon',
  'reminderNoConsent',
  'reminderNothingDue',
  'deleteAllConfirm',
  'onboardingDisclosure',
  'emptyFeed',
  'noNotes',
  'greeting',
  'removeAsk',
  'removeYes',
  'removed',
  'manage',
  'whenPick',
  'recordedAt',
  'voiceHint',
  'aiVoice',
  'addForCustomer',
];

export type LabelKey =
  | 'aiBadge'
  | 'navHome'
  | 'navCustomers'
  | 'navReminders'
  | 'navSettings'
  | 'todayCredit'
  | 'todayPayment'
  | 'peopleToday'
  | 'feedTitle'
  | 'emptyFeed'
  | 'credit'
  | 'payment'
  | 'note'
  | 'undo'
  | 'phaseIdle'
  | 'phaseListening'
  | 'phaseThinking'
  | 'phaseSpeaking'
  | 'phaseNeedsAnswer'
  | 'phaseOffline'
  | 'holdToTalk'
  | 'listeningHint'
  | 'customersTitle'
  | 'customerDetailTitle'
  | 'balanceDue'
  | 'entriesTitle'
  | 'notesTitle'
  | 'noNotes'
  | 'remind'
  | 'reminderOptIn'
  | 'reminderNoConsent'
  | 'reminderTooSoon'
  | 'reminderNothingDue'
  | 'remindersTitle'
  | 'settingsTitle'
  | 'language'
  | 'themeLight'
  | 'themeDark'
  | 'shopName'
  | 'encryptedOnThisPhone'
  | 'deleteAllData'
  | 'deleteAllConfirm'
  | 'deleteAllYes'
  | 'deleteAllNo'
  | 'onboardingTitle'
  | 'onboardingDisclosure'
  | 'startWithDemo'
  | 'startClean'
  | 'save'
  | 'backspace'
  | 'newName'
  | 'chooseCustomer'
  | 'amount'
  | 'offlineBanner'
  | 'mockMode'
  | 'entriesEmpty'
  | 'aiHeard'
  | 'aiQuestion'
  | 'confirmAmount'
  | 'isThisRight'
  | 'disambiguation'
  | 'retry'
  | 'greeting'
  | 'addEntry'
  | 'seeAll'
  | 'historyTitle'
  | 'manage'
  | 'remove'
  | 'removeAsk'
  | 'removeYes'
  | 'keep'
  | 'removed'
  | 'answerYes'
  | 'answerNo'
  | 'whenTitle'
  | 'whenNow'
  | 'whenYesterday'
  | 'whenPick'
  | 'recordedAt'
  | 'todayWord'
  | 'yesterdayWord'
  | 'back'
  | 'kindTitle'
  | 'paidToday'
  | 'creditGiven'
  | 'voiceHint'
  | 'aiVoice'
  | 'entryAdded'
  | 'noEntriesDay'
  | 'addForCustomer';

export const LABELS: Record<Lang, Record<LabelKey, string>> = {
  en: {
    aiBadge: 'AI',
    navHome: 'Home',
    navCustomers: 'Customers',
    navReminders: 'Remind',
    navSettings: 'Settings',
    todayCredit: 'Credit today',
    todayPayment: 'Paid today',
    peopleToday: 'People today',
    feedTitle: 'Recent entries',
    emptyFeed: 'No entries yet. Hold the mic and speak.',
    credit: 'Credit',
    payment: 'Paid',
    note: 'Note',
    undo: 'Undo',
    phaseIdle: 'Ready',
    phaseListening: 'Listening…',
    phaseThinking: 'Thinking…',
    phaseSpeaking: 'Speaking…',
    phaseNeedsAnswer: 'Needs answer',
    phaseOffline: 'Offline',
    holdToTalk: 'Hold to talk',
    listeningHint: 'Release to stop',
    customersTitle: 'Customers',
    customerDetailTitle: 'Customer',
    balanceDue: 'Balance due',
    entriesTitle: 'Entries',
    notesTitle: 'Notes',
    noNotes: 'No notes yet',
    remind: 'Remind',
    reminderOptIn: 'Reminder opt-in',
    reminderNoConsent: 'No reminder consent',
    reminderTooSoon: 'Reminder sent recently',
    reminderNothingDue: 'Nothing due',
    remindersTitle: 'Reminders',
    settingsTitle: 'Settings',
    language: 'Language',
    themeLight: 'Light',
    themeDark: 'Dark',
    shopName: 'Shop name',
    encryptedOnThisPhone: 'Encrypted on this phone',
    deleteAllData: 'Delete all data',
    deleteAllConfirm: 'Delete everything? This cannot be undone.',
    deleteAllYes: 'Delete all',
    deleteAllNo: 'Keep',
    onboardingTitle: 'Welcome to Vidur',
    onboardingDisclosure:
      'Vidur is an AI assistant. It keeps your ledger on this phone, encrypted. It is not a person. It will never judge your customers or lend you money.',
    startWithDemo: 'Start with demo data',
    startClean: 'Start empty',
    save: 'Save',
    backspace: 'Delete digit',
    newName: 'New name',
    chooseCustomer: 'Choose customer',
    amount: 'Amount',
    offlineBanner: 'No internet. Entries stay on this phone.',
    mockMode: 'Demo mode',
    entriesEmpty: 'No entries yet',
    aiHeard: 'I heard',
    aiQuestion: 'Question',
    confirmAmount: 'Amount',
    isThisRight: 'Is this right?',
    disambiguation: 'Which one?',
    retry: 'Try again',
    greeting: 'Hello',
    addEntry: 'Add entry',
    seeAll: 'See all',
    historyTitle: 'All entries',
    manage: 'Manage entry',
    remove: 'Remove',
    removeAsk: 'Remove this entry?',
    removeYes: 'Yes, remove',
    keep: 'Keep',
    removed: 'Entry removed',
    answerYes: 'Yes',
    answerNo: 'No',
    whenTitle: 'When',
    whenNow: 'Now',
    whenYesterday: 'Yesterday',
    whenPick: 'Pick date and time',
    recordedAt: 'Recorded',
    todayWord: 'Today',
    yesterdayWord: 'Yesterday',
    back: 'Back',
    kindTitle: 'Type',
    paidToday: 'Paid today',
    creditGiven: 'Credit today',
    voiceHint: 'Hold the circle and speak',
    aiVoice: 'Vidur voice',
    entryAdded: 'Entry added',
    noEntriesDay: 'Nothing here',
    addForCustomer: 'Add entry',
  },
  hi: {
    aiBadge: 'AI',
    navHome: 'होम',
    navCustomers: 'ग्राहक',
    navReminders: 'याद दिलाएँ',
    navSettings: 'सेटिंग',
    todayCredit: 'आज का उधार',
    todayPayment: 'आज जमा',
    peopleToday: 'आज के लोग',
    feedTitle: 'हाल के एंट्री',
    emptyFeed: 'अभी कोई एंट्री नहीं। माइक दबाकर बोलें।',
    credit: 'उधार',
    payment: 'जमा',
    note: 'नोट',
    undo: 'वापस लें',
    phaseIdle: 'तैयार',
    phaseListening: 'सुन रहा हूँ…',
    phaseThinking: 'सोच रहा हूँ…',
    phaseSpeaking: 'बोल रहा हूँ…',
    phaseNeedsAnswer: 'जवाब चाहिए',
    phaseOffline: 'ऑफ़लाइन',
    holdToTalk: 'बोलने के लिए दबाकर रखें',
    listeningHint: 'छोड़ने पर रुकेगा',
    customersTitle: 'ग्राहक',
    customerDetailTitle: 'ग्राहक',
    balanceDue: 'बकाया',
    entriesTitle: 'एंट्री',
    notesTitle: 'नोट',
    noNotes: 'कोई नोट नहीं',
    remind: 'याद दिलाएँ',
    reminderOptIn: 'रिमाइंडर की सहमति',
    reminderNoConsent: 'रिमाइंडर की सहमति नहीं',
    reminderTooSoon: 'रिमाइंडर अभी-अभी भेजा',
    reminderNothingDue: 'कुछ बकाया नहीं',
    remindersTitle: 'रिमाइंडर',
    settingsTitle: 'सेटिंग',
    language: 'भाषा',
    themeLight: 'हल्का',
    themeDark: 'गहरा',
    shopName: 'दुकान का नाम',
    encryptedOnThisPhone: 'इसी फ़ोन पर एन्क्रिप्टेड',
    deleteAllData: 'सारा डेटा हटाएँ',
    deleteAllConfirm: 'सब कुछ हटाएँ? यह वापस नहीं आएगा।',
    deleteAllYes: 'सब हटाएँ',
    deleteAllNo: 'रहने दें',
    onboardingTitle: 'Vidur में स्वागत है',
    onboardingDisclosure:
      'Vidur एक AI सहायक है। आपकी खाता-बही इसी फ़ोन पर एन्क्रिप्टेड रहती है। यह इंसान नहीं है। यह आपके ग्राहकों का फैसला नहीं करता और पैसा नहीं उधार देता।',
    startWithDemo: 'डेमो डेटा के साथ शुरू करें',
    startClean: 'खाली शुरू करें',
    save: 'सेव करें',
    backspace: 'अंक हटाएँ',
    newName: 'नया नाम',
    chooseCustomer: 'ग्राहक चुनें',
    amount: 'रकम',
    offlineBanner: 'इंटरनेट नहीं। एंट्री इसी फ़ोन पर रहेंगी।',
    mockMode: 'डेमो मोड',
    entriesEmpty: 'अभी कोई एंट्री नहीं',
    aiHeard: 'मैंने सुना',
    aiQuestion: 'सवाल',
    confirmAmount: 'रकम',
    isThisRight: 'क्या यह सही है?',
    disambiguation: 'कौन सा?',
    retry: 'फिर से कोशिश करें',
    greeting: 'नमस्ते',
    addEntry: 'एंट्री जोड़ें',
    seeAll: 'सब देखें',
    historyTitle: 'सभी एंट्री',
    manage: 'एंट्री बदलें',
    remove: 'हटाएँ',
    removeAsk: 'यह एंट्री हटाएँ?',
    removeYes: 'हाँ, हटाएँ',
    keep: 'रहने दें',
    removed: 'एंट्री हटा दी',
    answerYes: 'हाँ',
    answerNo: 'नहीं',
    whenTitle: 'कब',
    whenNow: 'अभी',
    whenYesterday: 'कल',
    whenPick: 'तारीख़ और समय चुनें',
    recordedAt: 'दर्ज किया',
    todayWord: 'आज',
    yesterdayWord: 'कल',
    back: 'वापस',
    kindTitle: 'किस्म',
    paidToday: 'आज जमा',
    creditGiven: 'आज उधार',
    voiceHint: 'गोले को दबाकर बोलिए',
    aiVoice: 'विदुर की आवाज़',
    entryAdded: 'एंट्री जुड़ गई',
    noEntriesDay: 'यहाँ कुछ नहीं',
    addForCustomer: 'एंट्री जोड़ें',
  },
  kn: {
    aiBadge: 'AI',
    navHome: 'ಮನೆ',
    navCustomers: 'ಗ್ರಾಹಕರು',
    navReminders: 'ನೆನಪು',
    navSettings: 'ಸೆಟ್ಟಿಂಗ್',
    todayCredit: 'ಇಂದಿನ ಉಧಾರ',
    todayPayment: 'ಇಂದು ಜಮಾ',
    peopleToday: 'ಇಂದಿನ ಜನರು',
    feedTitle: 'ಇತ್ತೀಚಿನ ನಮೂದು',
    emptyFeed: 'ಇನ್ನೂ ಯಾವುದೇ ನಮೂದು ಇಲ್ಲ. ಮೈಕ್ ಒತ್ತಿ ಹೇಳಿ.',
    credit: 'ಉಧಾರ',
    payment: 'ಜಮಾ',
    note: 'ಟಿಪ್ಪಣಿ',
    undo: 'ಹಿಂದಕ್ಕೆ',
    phaseIdle: 'ಸಿದ್ಧ',
    phaseListening: 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದೆ…',
    phaseThinking: 'ಯೋಚಿಸುತ್ತಿದೆ…',
    phaseSpeaking: 'ಮಾತನಾಡುತ್ತಿದೆ…',
    phaseNeedsAnswer: 'ಉತ್ತರ ಬೇಕು',
    phaseOffline: 'ಆಫ್‌ಲೈನ್',
    holdToTalk: 'ಒತ್ತಿಹಿಡಿದು ಮಾತನಾಡಿ',
    listeningHint: 'ಬಿಟ್ಟಾಗ ನಿಲ್ಲುತ್ತದೆ',
    customersTitle: 'ಗ್ರಾಹಕರು',
    customerDetailTitle: 'ಗ್ರಾಹಕ',
    balanceDue: 'ಬಾಕಿ',
    entriesTitle: 'ನಮೂದುಗಳು',
    notesTitle: 'ಟಿಪ್ಪಣಿಗಳು',
    noNotes: 'ಯಾವುದೇ ಟಿಪ್ಪಣಿ ಇಲ್ಲ',
    remind: 'ನೆನಪು ಕಳಿಸಿ',
    reminderOptIn: 'ನೆನಪಿನ ಒಪ್ಪಿಗೆ',
    reminderNoConsent: 'ನೆನಪಿನ ಒಪ್ಪಿಗೆ ಇಲ್ಲ',
    reminderTooSoon: 'ನೆನಪು ಇತ್ತೀಚೆಗೆ ಕಳುಹಿಸಲಾಗಿದೆ',
    reminderNothingDue: 'ಯಾವುದೇ ಬಾಕಿ ಇಲ್ಲ',
    remindersTitle: 'ನೆನಪುಗಳು',
    settingsTitle: 'ಸೆಟ್ಟಿಂಗ್',
    language: 'ಭಾಷೆ',
    themeLight: 'ತಿಳಿ',
    themeDark: 'ಕಪ್ಪು',
    shopName: 'ಅಂಗಡಿ ಹೆಸರು',
    encryptedOnThisPhone: 'ಈ ಫೋನ್‌ನಲ್ಲಿ ಎನ್‌ಕ್ರಿಪ್ಟ್',
    deleteAllData: 'ಎಲ್ಲ ಡೇಟಾ ಅಳಿಸಿ',
    deleteAllConfirm: 'ಎಲ್ಲವನ್ನೂ ಅಳಿಸುವುದೇ? ಇದನ್ನು ಹಿಂದಿರುಗಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.',
    deleteAllYes: 'ಎಲ್ಲ ಅಳಿಸಿ',
    deleteAllNo: 'ಬಿಡಿ',
    onboardingTitle: 'Vidur ಗೆ ಸ್ವಾಗತ',
    onboardingDisclosure:
      'Vidur ಒಂದು AI ಸಹಾಯಕ. ನಿಮ್ಮ ಖಾತೆ ಈ ಫೋನ್‌ನಲ್ಲೇ ಎನ್‌ಕ್ರಿಪ್ಟ್ ಆಗಿದೆ. ಇದು ಮನುಷ್ಯ ಅಲ್ಲ. ಇದು ನಿಮ್ಮ ಗ್ರಾಹಕರನ್ನು ನಿರ್ಣಯಿಸುವುದಿಲ್ಲ ಮತ್ತು ಹಣ ಸಾಲ ಕೊಡುವುದಿಲ್ಲ.',
    startWithDemo: 'ಡೆಮೊ ಡೇಟಾದೊಂದಿಗೆ ಪ್ರಾರಂಭಿಸಿ',
    startClean: 'ಖಾಲಿ ಪ್ರಾರಂಭಿಸಿ',
    save: 'ಉಳಿಸಿ',
    backspace: 'ಅಂಕಿ ಅಳಿಸಿ',
    newName: 'ಹೊಸ ಹೆಸರು',
    chooseCustomer: 'ಗ್ರಾಹಕರನ್ನು ಆರಿಸಿ',
    amount: 'ಮೊತ್ತ',
    offlineBanner: 'ಇಂಟರ್ನೆಟ್ ಇಲ್ಲ. ನಮೂದು ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.',
    mockMode: 'ಡೆಮೊ ಮೋಡ್',
    entriesEmpty: 'ಇನ್ನೂ ನಮೂದು ಇಲ್ಲ',
    aiHeard: 'ನಾನು ಕೇಳಿದ್ದು',
    aiQuestion: 'ಪ್ರಶ್ನೆ',
    confirmAmount: 'ಮೊತ್ತ',
    isThisRight: 'ಸರಿಯೇ?',
    disambiguation: 'ಯಾವುದು?',
    retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    greeting: 'ನಮಸ್ಕಾರ',
    addEntry: 'ನಮೂದು ಸೇರಿಸಿ',
    seeAll: 'ಎಲ್ಲಾ ನೋಡಿ',
    historyTitle: 'ಎಲ್ಲಾ ನಮೂದುಗಳು',
    manage: 'ನಮೂದು ನಿರ್ವಹಿಸಿ',
    remove: 'ತೆಗೆಯಿರಿ',
    removeAsk: 'ಈ ನಮೂದು ತೆಗೆಯಬೇಕೆ?',
    removeYes: 'ಹೌದು, ತೆಗೆಯಿರಿ',
    keep: 'ಇರಲಿ',
    removed: 'ನಮೂದು ತೆಗೆದಿದೆ',
    answerYes: 'ಹೌದು',
    answerNo: 'ಇಲ್ಲ',
    whenTitle: 'ಯಾವಾಗ',
    whenNow: 'ಈಗ',
    whenYesterday: 'ನಿನ್ನೆ',
    whenPick: 'ದಿನಾಂಕ ಮತ್ತು ಸಮಯ ಆರಿಸಿ',
    recordedAt: 'ದಾಖಲಿಸಿದ್ದು',
    todayWord: 'ಇಂದು',
    yesterdayWord: 'ನಿನ್ನೆ',
    back: 'ಹಿಂದೆ',
    kindTitle: 'ವಿಧ',
    paidToday: 'ಇಂದು ಪಾವತಿ',
    creditGiven: 'ಇಂದು ಸಾಲ',
    voiceHint: 'ವೃತ್ತವನ್ನು ಒತ್ತಿಹಿಡಿದು ಮಾತನಾಡಿ',
    aiVoice: 'ವಿದುರ್ ಧ್ವನಿ',
    entryAdded: 'ನಮೂದು ಸೇರಿದೆ',
    noEntriesDay: 'ಇಲ್ಲಿ ಏನೂ ಇಲ್ಲ',
    addForCustomer: 'ನಮೂದು ಸೇರಿಸಿ',
  },
};

export const PHASE_LABEL_KEY: Record<Phase, LabelKey> = {
  idle: 'phaseIdle',
  listening: 'phaseListening',
  thinking: 'phaseThinking',
  speaking: 'phaseSpeaking',
  needs_answer: 'phaseNeedsAnswer',
  offline: 'phaseOffline',
};
