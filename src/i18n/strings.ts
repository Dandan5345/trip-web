/**
 * Hebrew first, with the English column already in place so adding a language
 * later is a data change rather than a refactor. Every user-visible string in
 * the app goes through here.
 */
export const LOCALES = ['he', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DIRECTION: Record<Locale, 'rtl' | 'ltr'> = {
  he: 'rtl',
  en: 'ltr',
};

export const strings = {
  he: {
    appName: 'TripEase',
    tagline: 'פתיחת טיול במחשב',

    // Pairing
    pairTitle: 'פתיחת טיול במחשב',
    pairIntro: 'חברו את הטיול שפתוח באפליקציה כדי לערוך אותו כאן, במסך גדול.',
    pairStep1: 'פתחו את הטיול באפליקציה',
    pairStep2: 'לחצו על שיתוף',
    pairStep3: 'בחרו "פתיחת האתר במחשב"',
    pairStep4: 'סרקו את הקוד שמופיע כאן, או הקלידו את הקוד הקצר',
    pairWaiting: 'ממתינים לסריקה מהטלפון…',
    pairCodeLabel: 'או הקלידו באפליקציה את הקוד',
    pairExpiresIn: 'הקוד תקף עוד',
    pairExpired: 'תוקף הקוד פג',
    pairNewCode: 'יצירת קוד חדש',
    pairApproved: 'הטלפון אישר את החיבור — טוענים את הטיול…',
    pairPreparing: 'מכינים חיבור מאובטח…',
    pairRevoked: 'החיבור נותק מהטלפון',
    pairSessionExpired: 'החיבור פג. צרו קוד חדש כדי להתחבר שוב.',
    pairErrorTitle: 'לא הצלחנו להתחיל חיבור',
    pairRetry: 'ניסיון נוסף',
    pairSecurityNote:
      'הקוד לא מכיל את הטיול ולא את מפתח ההצפנה שלו. המפתח מועבר מהטלפון מוצפן, ונשאר רק בזיכרון הדפדפן.',
    pairAnonDisabled:
      'התחברות אנונימית אינה מופעלת בפרויקט Firebase, ולכן האתר לא יכול ליצור חיבור. הפעילו את הספק Anonymous במסוף Firebase.',
    pairOffline: 'אין חיבור לאינטרנט.',

    // Shell
    navHome: 'מסך הטיול',
    navPlaces: 'מקומות לביקור',
    navLogistics: 'מלונות ומעברים',
    navSchedule: 'לו״ז',
    navBookings: 'אישורי הזמנות',
    navDocuments: 'מסמכים וצ׳ק ליסטים',
    navExpenses: 'מעקב הוצאות',
    navMap: 'מפת המסלול',
    closeSession: 'סגירת הטיול במחשב',
    closeSessionConfirm: 'לסגור את הטיול במחשב? החיבור יבוטל ותצטרכו קוד חדש.',
    readOnly: 'צפייה בלבד',
    canEditBadge: 'ניתן לעריכה',
    lockedTitle: 'ננעל מחוסר פעילות',
    lockedBody: 'סגרנו את הטיול אוטומטית כדי להגן על המידע. התחברו שוב מהטלפון.',
    reconnect: 'התחברות מחדש',

    // Trip home
    loadingTrip: 'טוענים את הטיול…',
    tripMissingTitle: 'הטיול לא נמצא',
    tripMissingBody: 'ייתכן שהטיול נמחק או שההרשאה בוטלה מהטלפון.',
    daysUntil: 'בעוד {n} ימים!',
    tripStarted: 'הטיול התחיל',
    tripToday: 'מתחילים היום',
    tripEnded: 'הטיול הסתיים',
    nights: 'לילות',
    days: 'ימים',
    travelers: 'מטיילים',
    destinations: 'יעדים',
    noDates: 'ללא תאריכים',
    editTrip: 'עריכת פרטי הטיול',
    save: 'שמירה',
    cancel: 'ביטול',
    close: 'סגירה',
    saving: 'שומרים…',
    saved: 'נשמר',
    saveFailed: 'השמירה נכשלה',
    conflictTitle: 'הטיול השתנה בטלפון',
    conflictBody:
      'מישהו עדכן את הטיול בזמן שערכתם כאן. בחרו איזו גרסה לשמור.',
    conflictKeepMine: 'לשמור את השינוי שלי',
    conflictKeepTheirs: 'לקחת את הגרסה מהטלפון',

    fieldName: 'שם הטיול',
    fieldDescription: 'תיאור',
    fieldStartDate: 'תאריך התחלה',
    fieldEndDate: 'תאריך סיום',
    fieldTravelers: 'מספר מטיילים',

    sectionHotels: 'מלונות',
    sectionFlights: 'טיסות',
    sectionCars: 'רכב',
    sectionRides: 'הסעות',
    sectionTrains: 'רכבות',
    sectionFerries: 'מעבורות',
    sectionCruises: 'שייט',
    sectionNextUp: 'הקרוב בלו״ז',
    viewAll: 'הצגת הכל',
    emptyLogistics: 'עדיין לא נוספו מלונות או מעברים לטיול הזה.',
    emptySchedule: 'אין עדיין פעילויות בלו״ז.',
    emptyGeneric: 'אין כאן עדיין מידע.',

    checkIn: 'צ׳ק־אין',
    checkOut: 'צ׳ק־אאוט',
    departure: 'יציאה',
    arrival: 'הגעה',
    pickup: 'איסוף',
    dropoff: 'החזרה',
    seat: 'מושב',
    seatClass: 'מחלקה',
    passengers: 'נוסעים',
    price: 'מחיר',
    paid: 'שולם',
    notPaid: 'לא שולם',
    partiallyPaid: 'שולם חלקית',
    notes: 'הערות',
    address: 'כתובת',
    bookingLink: 'קישור להזמנה',
    openLink: 'פתיחה',
    details: 'פרטים',

    // Encryption / device-only
    encryptedTitle: 'מידע מוצפן',
    encryptedBody:
      'החיבור הזה לא קיבל הרשאה למידע רגיש, ולכן הפרטים האלה נשארים מוצפנים.',
    encryptedField: 'מוצפן',
    phoneOnlyTitle: 'זמין רק בטלפון',
    phoneOnlyBody:
      'הפרטים האלה נשמרים רק במכשיר עצמו ולא מסונכרנים לענן, ולכן אינם זמינים במחשב.',
    attachmentsPhoneOnly: 'קבצים מצורפים זמינים כרגע רק בטלפון.',

    // Weather
    weather: 'מזג האוויר',
    weatherUnavailable: 'לא הצלחנו לטעון תחזית.',

    // Placeholders
    underConstruction: 'העמוד בתהליך בנייה',
    underConstructionBody:
      'החלק הזה עדיין לא נבנה בגרסת המחשב. בינתיים אפשר לראות ולערוך אותו באפליקציה.',
    backToTrip: 'חזרה למסך הטיול',

    // Misc
    retry: 'ניסיון נוסף',
    errorTitle: 'משהו השתבש',
    copy: 'העתקה',
    copied: 'הועתק',
  },

  en: {
    appName: 'TripEase',
    tagline: 'Open a trip on your computer',

    pairTitle: 'Open a trip on your computer',
    pairIntro: 'Connect the trip you have open in the app to edit it here, on a big screen.',
    pairStep1: 'Open the trip in the app',
    pairStep2: 'Tap Share',
    pairStep3: 'Choose “Open the site on your computer”',
    pairStep4: 'Scan the code shown here, or type the short code',
    pairWaiting: 'Waiting for your phone…',
    pairCodeLabel: 'Or type this code in the app',
    pairExpiresIn: 'Code expires in',
    pairExpired: 'This code has expired',
    pairNewCode: 'Generate a new code',
    pairApproved: 'Your phone approved the connection — loading the trip…',
    pairPreparing: 'Preparing a secure connection…',
    pairRevoked: 'The connection was ended from your phone',
    pairSessionExpired: 'The connection expired. Generate a new code to reconnect.',
    pairErrorTitle: 'Could not start a connection',
    pairRetry: 'Try again',
    pairSecurityNote:
      'The code carries no trip data and no encryption key. The key arrives from your phone encrypted and stays only in this browser’s memory.',
    pairAnonDisabled:
      'Anonymous sign-in is not enabled on this Firebase project, so the site cannot open a session. Enable the Anonymous provider in the Firebase Console.',
    pairOffline: 'You appear to be offline.',

    navHome: 'Trip overview',
    navPlaces: 'Places to visit',
    navLogistics: 'Hotels & transfers',
    navSchedule: 'Schedule',
    navBookings: 'Confirmations',
    navDocuments: 'Docs & checklists',
    navExpenses: 'Expenses',
    navMap: 'Route map',
    closeSession: 'Close this trip',
    closeSessionConfirm: 'Close this trip on the computer? The connection ends and you will need a new code.',
    readOnly: 'View only',
    canEditBadge: 'Editing allowed',
    lockedTitle: 'Locked after inactivity',
    lockedBody: 'We closed the trip automatically to protect your data. Connect again from your phone.',
    reconnect: 'Connect again',

    loadingTrip: 'Loading the trip…',
    tripMissingTitle: 'Trip not found',
    tripMissingBody: 'It may have been deleted, or access was revoked from the phone.',
    daysUntil: 'In {n} days!',
    tripStarted: 'Trip in progress',
    tripToday: 'Starts today',
    tripEnded: 'Trip finished',
    nights: 'nights',
    days: 'days',
    travelers: 'travellers',
    destinations: 'destinations',
    noDates: 'No dates',
    editTrip: 'Edit trip details',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'Could not save',
    conflictTitle: 'The trip changed on your phone',
    conflictBody: 'Someone updated the trip while you were editing here. Choose which version to keep.',
    conflictKeepMine: 'Keep my change',
    conflictKeepTheirs: 'Take the phone’s version',

    fieldName: 'Trip name',
    fieldDescription: 'Description',
    fieldStartDate: 'Start date',
    fieldEndDate: 'End date',
    fieldTravelers: 'Travellers',

    sectionHotels: 'Hotels',
    sectionFlights: 'Flights',
    sectionCars: 'Car rental',
    sectionRides: 'Rides',
    sectionTrains: 'Trains',
    sectionFerries: 'Ferries',
    sectionCruises: 'Cruises',
    sectionNextUp: 'Next up',
    viewAll: 'View all',
    emptyLogistics: 'No hotels or transfers have been added to this trip yet.',
    emptySchedule: 'No activities scheduled yet.',
    emptyGeneric: 'Nothing here yet.',

    checkIn: 'Check-in',
    checkOut: 'Check-out',
    departure: 'Departure',
    arrival: 'Arrival',
    pickup: 'Pick-up',
    dropoff: 'Return',
    seat: 'Seat',
    seatClass: 'Class',
    passengers: 'Passengers',
    price: 'Price',
    paid: 'Paid',
    notPaid: 'Not paid',
    partiallyPaid: 'Partially paid',
    notes: 'Notes',
    address: 'Address',
    bookingLink: 'Booking link',
    openLink: 'Open',
    details: 'Details',

    encryptedTitle: 'Encrypted details',
    encryptedBody: 'This connection was not granted access to sensitive data, so these details stay encrypted.',
    encryptedField: 'Encrypted',
    phoneOnlyTitle: 'Only on your phone',
    phoneOnlyBody:
      'These details are stored on the device itself and are not synced to the cloud, so they are not available here.',
    attachmentsPhoneOnly: 'Attachments are currently available on the phone only.',

    weather: 'Weather',
    weatherUnavailable: 'Could not load the forecast.',

    underConstruction: 'This page is being built',
    underConstructionBody:
      'This section is not built yet in the desktop version. You can view and edit it in the app meanwhile.',
    backToTrip: 'Back to the trip',

    retry: 'Try again',
    errorTitle: 'Something went wrong',
    copy: 'Copy',
    copied: 'Copied',
  },
} as const;

export type StringKey = keyof (typeof strings)['he'];
