// Single source of truth for demo content — consumed directly by the app
// when no Firebase project is connected yet (see useLiveOrDemo), and by
// `scripts/seed.mjs` to populate a real Firestore project with the exact
// same illustrative data. Money is stored in integer minor units (agorot).

export const demoAdmissions = [
  { id: 'a1', name: 'سارة العلي', guardian: 'محمد العلي', grade: 'الثالث الأساسي', phone: '0599 118 221', source: 'الموقع', status: 'review', daysAgo: 0 },
  { id: 'a2', name: 'نور سالم', guardian: 'سالم إبراهيم', grade: 'الأول الأساسي', phone: '0599 812 004', source: 'إحالة', status: 'review', daysAgo: 0, duplicateWarning: true },
  { id: 'a3', name: 'ليان قاسم', guardian: 'قاسم يوسف', grade: 'الروضة', phone: '0599 553 771', source: 'الموقع', status: 'review', daysAgo: 1 },
  { id: 'a4', name: 'آدم فارس', guardian: 'فارس ناصر', grade: 'الرابع الأساسي', phone: '0599 907 330', source: 'فيسبوك', status: 'review', daysAgo: 1 },
  { id: 'a5', name: 'جود حسن', guardian: 'حسن علي', grade: 'الثاني الأساسي', phone: '0599 461 552', source: 'الموقع', status: 'review', daysAgo: 2 },
  { id: 'a6', name: 'تالا زيد', guardian: 'زيد محمود', grade: 'السادس الأساسي', phone: '0599 220 118', source: 'إحالة', status: 'review', daysAgo: 2 },
  { id: 'a7', name: 'كنان وليد', guardian: 'وليد كنان', grade: 'الثاني الأساسي', phone: '0599 311 887', source: 'الموقع', status: 'accepted', daysAgo: 3 },
  { id: 'a8', name: 'ميرا سامي', guardian: 'سامي ميرا', grade: 'الأول الأساسي', phone: '0599 774 220', source: 'إحالة', status: 'accepted', daysAgo: 4 },
  { id: 'a9', name: 'لؤي هاني', guardian: 'هاني لؤي', grade: 'الخامس الأساسي', phone: '0599 205 663', source: 'الموقع', status: 'accepted', daysAgo: 7 },
  { id: 'a10', name: 'راكان بدر', guardian: 'بدر راكان', grade: 'السادس الأساسي', phone: '0599 640 119', source: 'فيسبوك', status: 'rejected', daysAgo: 5 },
  { id: 'a11', name: 'سيلين مازن', guardian: 'مازن سيلين', grade: 'الروضة', phone: '0599 889 004', source: 'الموقع', status: 'rejected', daysAgo: 7 },
];

export const demoStudents = [
  { id: 's1', name: 'يوسف الأحمد', displayId: 'STU-1042', nationalId: '401234567', grade: 'الخامس / أ', shift: 'صباحي', status: 'نشط', guardianName: 'خالد الأحمد', initial: 'ي', balanceMinorUnits: 12000 },
  { id: 's2', name: 'مريم الخطيب', displayId: 'STU-0987', nationalId: '402345678', grade: 'الرابع / ب', shift: 'صباحي', status: 'نشط', guardianName: 'سامي الخطيب', initial: 'م', balanceMinorUnits: 0 },
  { id: 's3', name: 'عمر ناصر', displayId: 'STU-1150', nationalId: '403456789', grade: 'السادس / أ', shift: 'مسائي', status: 'نشط', guardianName: 'ناصر عمر', initial: 'ع', balanceMinorUnits: 34000 },
  { id: 's4', name: 'رهف سليمان', displayId: 'STU-0771', nationalId: '404567890', grade: 'الثالث / أ', shift: 'صباحي', status: 'نشط', guardianName: 'سليمان رهف', initial: 'ر', balanceMinorUnits: 0 },
  { id: 's5', name: 'زيد الحوراني', displayId: 'STU-1201', nationalId: '405678901', grade: 'الأول / ج', shift: 'صباحي', status: 'نشط', guardianName: 'محمود الحوراني', initial: 'ز', balanceMinorUnits: 8000 },
  { id: 's6', name: 'سلمى داوود', displayId: 'STU-0654', nationalId: '406789012', grade: 'الخامس / ب', shift: 'صباحي', status: 'متخرّج', guardianName: 'داوود سلمى', initial: 'س', balanceMinorUnits: 0 },
  { id: 's7', name: 'كرم عبدالله', displayId: 'STU-1099', nationalId: '407890123', grade: 'الثاني / أ', shift: 'مسائي', status: 'نشط', guardianName: 'عبدالله كرم', initial: 'ك', balanceMinorUnits: 52000 },
  { id: 's8', name: 'ليان مرعي', displayId: 'STU-1188', nationalId: '408901234', grade: 'الروضة', shift: 'صباحي', status: 'نشط', guardianName: 'مرعي ليان', initial: 'ل', balanceMinorUnits: 0 },
];

export const demoStudentDetail = {
  s1: {
    age: 11, joinedDate: '2024-09-01',
    guardians: [
      { name: 'خالد الأحمد', relation: 'الأب', phone: '0599 812', primary: true },
      { name: 'نورة الأحمد', relation: 'الأم', phone: '0599 340', primary: false },
    ],
    finance: { billedMinorUnits: 120000, collectedMinorUnits: 90000, discountMinorUnits: 18000, dueMinorUnits: 12000 },
    ledger: [
      { date: '2026-09-01', item: 'رسوم دراسية — الفصل الأول', debitMinorUnits: 120000, creditMinorUnits: 0, balanceMinorUnits: 120000 },
      { date: '2026-09-01', item: 'منحة تفوّق (15%)', debitMinorUnits: 0, creditMinorUnits: 18000, balanceMinorUnits: 102000 },
      { date: '2026-09-10', item: 'دفعة نقدية — إيصال #4471', debitMinorUnits: 0, creditMinorUnits: 50000, balanceMinorUnits: 52000 },
      { date: '2026-10-05', item: 'دفعة تحويل — إيصال #4590', debitMinorUnits: 0, creditMinorUnits: 40000, balanceMinorUnits: 12000 },
    ],
    documents: [
      { name: 'شهادة الميلاد', type: 'PDF', date: '2024-08-20', status: 'موثّق', tone: 'accent' },
      { name: 'صورة الهوية لولي الأمر', type: 'JPG', date: '2024-08-20', status: 'موثّق', tone: 'accent' },
      { name: 'التقرير الطبي', type: 'PDF', date: '2024-09-01', status: 'بانتظار التحديث', tone: 'outline' },
      { name: 'كشف العلامات السابق', type: 'PDF', date: '2024-08-25', status: 'موثّق', tone: 'accent' },
    ],
    classes: [
      { classId: 'demo-class-0', subject: 'لغة عربية', title: 'حروف المدّ والقراءة', teacher: 'أ. خالد الأحمد', teacherId: 't-khaled', shift: 'صباحي', grade: 'ممتاز' },
      { classId: 'demo-class-1', subject: 'رياضيات', title: 'الكسور والأعداد', teacher: 'أ. رنا عادل', teacherId: 't-rana', shift: 'صباحي', grade: 'جيد جداً' },
      { classId: 'demo-class-2', subject: 'علوم', title: 'دورة الماء', teacher: 'أ. سمير فؤاد', teacherId: 't-samir', shift: 'صباحي', grade: 'ممتاز' },
    ],
    notes: [
      { kind: 'أكاديمي', sentiment: 'إيجابي', note: 'تحسّن ملحوظ في القراءة الجهرية.', by: 'أ. خالد', daysAgo: 0 },
      { kind: 'اجتماعي', sentiment: 'إيجابي', note: 'يشارك بفعالية في الأنشطة الجماعية.', by: 'أ. رنا', daysAgo: 2 },
    ],
    avgGrade: '92%', attendancePct: '97%',
  },
};

export const demoDashboard = {
  kpis: [
    { label: 'إجمالي الطلاب', value: '842', delta: '+18 هذا الشهر', icon: 'group' },
    { label: 'إيراد الشهر', value: '₪ 128٬400', delta: '▲ 6% عن الشهر الماضي', icon: 'trending_up' },
    { label: 'المستحقات القائمة', value: '₪ 47٬900', delta: '132 طالباً متأخّراً', icon: 'schedule' },
    { label: 'صافي النتيجة', value: '₪ 61٬200', delta: 'بعد الرواتب والمصاريف', icon: 'balance' },
  ],
  chartBars: [
    { m: 'مارس', rev: 58, exp: 40 }, { m: 'أبريل', rev: 64, exp: 42 },
    { m: 'مايو', rev: 55, exp: 45 }, { m: 'يونيو', rev: 48, exp: 38 },
    { m: 'يوليو', rev: 40, exp: 30 }, { m: 'أغسطس', rev: 52, exp: 36 },
    { m: 'سبتمبر', rev: 78, exp: 50 }, { m: 'أكتوبر', rev: 88, exp: 52 },
  ],
  collect: [
    { label: 'محصّل', amount: '₪ 128٬400', pct: 78, color: 'var(--color-accent-600)' },
    { label: 'قيد الانتظار', amount: '₪ 12٬300', pct: 14, color: 'var(--color-neutral-500)' },
    { label: 'متأخّر', amount: '₪ 47٬900', pct: 30, color: 'var(--color-accent-800)' },
  ],
  collectionRate: '78%',
  activity: [
    { icon: 'person_add', text: 'قبول تسجيل: سارة العلي — الصف الثالث', who: 'أحمد (السكرتارية)', hoursAgo: 0.2 },
    { icon: 'receipt_long', text: 'تأكيد دفعة ₪ 400 — يوسف الأحمد', who: 'ليلى (المالية)', hoursAgo: 1 },
    { icon: 'menu_book', text: 'نشر درس «حروف المدّ» في صف اللغة العربية', who: 'خالد (معلّم)', hoursAgo: 3 },
    { icon: 'workspace_premium', text: 'إصدار شهادة الفصل الأول — الصف الخامس', who: 'فاطمة (المالكة)', hoursAgo: 26 },
  ],
  todo: [
    { icon: 'assignment', label: 'طلبات تسجيل بانتظار المراجعة', count: 6, to: '/admin/admissions' },
    { icon: 'receipt_long', label: 'دفعات بانتظار التأكيد', count: 9, to: '/admin/billing' },
    { icon: 'account_balance_wallet', label: 'رواتب أكتوبر بانتظار الاعتماد', count: 23, to: '/admin/payroll' },
    { icon: 'forum', label: 'تعليقات بانتظار الإشراف', count: 4, to: '/admin/cms' },
  ],
};

export const demoBilling = {
  kpis: [
    { label: 'مفوتر (الشهر)', value: '₪ 176٬300' },
    { label: 'محصّل ومؤكَّد', value: '₪ 128٬400' },
    { label: 'منح وخصومات', value: '₪ 14٬100' },
    { label: 'قائم', value: '₪ 47٬900' },
  ],
  charges: [
    { student: 'يوسف الأحمد', studentId: 's1', stageLabel: 'الخامس الأساسي', grade: 'الخامس / أ', classSection: 'أ', type: 'رسوم دراسية', amount: '₪ 400', discount: '− ₪ 60', status: 'مؤكَّد', tone: 'accent', method: 'تحويل' },
    { student: 'مريم الخطيب', studentId: 's2', stageLabel: 'الرابع الأساسي', grade: 'الرابع / ب', classSection: 'ب', type: 'رسوم دراسية', amount: '₪ 400', discount: '—', status: 'مؤكَّد', tone: 'accent', method: 'نقد' },
    { student: 'عمر ناصر', studentId: 's3', stageLabel: 'السادس الأساسي', grade: 'السادس / أ', classSection: 'أ', type: 'رسوم دراسية', amount: '₪ 400', discount: '—', status: 'قيد التأكيد', tone: 'outline', method: 'شيك' },
    { student: 'زيد الحوراني', studentId: 's5', stageLabel: 'الأول الأساسي', grade: 'الأول / ج', classSection: 'ج', type: 'مواصلات', amount: '₪ 80', discount: '—', status: 'مسودّة', tone: 'neutral', method: '—' },
    { student: 'كرم عبدالله', studentId: 's7', stageLabel: 'الثاني الأساسي', grade: 'الثاني / أ', classSection: 'أ', type: 'رسوم دراسية', amount: '₪ 400', discount: '—', status: 'متأخّر', tone: 'accent2', method: '—' },
    { student: 'رهف سليمان', studentId: 's4', stageLabel: 'الثالث الأساسي', grade: 'الثالث / أ', classSection: 'أ', type: 'زيّ مدرسي', amount: '₪ 45', discount: '—', status: 'مؤكَّد', tone: 'accent', method: 'نقد' },
    { student: 'ليان مرعي', studentId: 's8', stageLabel: 'الروضة', grade: 'الروضة', classSection: null, type: 'رسوم دراسية', amount: '₪ 350', discount: '—', status: 'مؤكَّد', tone: 'accent', method: 'تحويل' },
  ],
};

export const demoPayroll = [
  { name: 'خالد الأحمد', role: 'معلّم لغة عربية', type: 'راتب شهري', days: '22 / 22', base: '₪ 620', adj: '+ ₪ 40', net: '₪ 660', stage: 'computed' },
  { name: 'ليلى حسن', role: 'مسؤولة مالية', type: 'راتب شهري', days: '22 / 22', base: '₪ 720', adj: '—', net: '₪ 720', stage: 'computed' },
  { name: 'أحمد سعيد', role: 'سكرتارية', type: 'راتب شهري', days: '20 / 22', base: '₪ 480', adj: '− ₪ 44', net: '₪ 436', stage: 'computed' },
  { name: 'رنا عادل', role: 'معلّمة رياضيات', type: 'راتب يومي', days: '18', base: '₪ 30/يوم', adj: '—', net: '₪ 540', stage: 'open' },
  { name: 'سمير فؤاد', role: 'مشرف', type: 'راتب شهري', days: '22 / 22', base: '₪ 550', adj: '+ ₪ 25', net: '₪ 575', stage: 'computed' },
  { name: 'هدى مالك', role: 'معلّمة روضة', type: 'راتب شهري', days: '21 / 22', base: '₪ 500', adj: '− ₪ 23', net: '₪ 477', stage: 'computed' },
];

export const demoExpenseCategories = [
  { name: 'رواتب', amount: '₪ 42٬600', pct: 100 },
  { name: 'إيجار', amount: '₪ 9٬000', pct: 46 },
  { name: 'مرافق (كهرباء/ماء)', amount: '₪ 3٬200', pct: 22 },
  { name: 'صيانة', amount: '₪ 1٬450', pct: 14 },
  { name: 'قرطاسية ومستلزمات', amount: '₪ 980', pct: 10 },
];

export const demoExpenses = [
  { date: '2026-10-01', vendor: 'شركة الكهرباء', category: 'مرافق', amount: '₪ 1٬100', status: 'مدفوع', tone: 'accent' },
  { date: '2026-10-01', vendor: 'مالك العقار', category: 'إيجار', amount: '₪ 3٬000', status: 'مدفوع', tone: 'accent' },
  { date: '2026-10-03', vendor: 'مكتبة النور', category: 'قرطاسية', amount: '₪ 320', status: 'قيد الدفع', tone: 'outline' },
  { date: '2026-10-04', vendor: 'صيانة التكييف', category: 'صيانة', amount: '₪ 450', status: 'قيد الدفع', tone: 'outline' },
  { date: '2026-10-06', vendor: 'مزوّد الإنترنت', category: 'اشتراكات', amount: '₪ 90', status: 'مجدول', tone: 'neutral' },
  { date: '2026-10-07', vendor: 'شركة النظافة', category: 'خدمات', amount: '₪ 260', status: 'مدفوع', tone: 'accent' },
];

export const demoClasses = [
  { id: 'demo-class-0', subject: 'لغة عربية', title: 'حروف المدّ والقراءة', teacher: 'خالد الأحمد', teacherId: 't-khaled', grade: 'الخامس الأساسي', shift: 'صباحي', lessons: 14, students: 28, visibility: 'عام', tone: 'accent', schedule: [{ day: 'الأحد', start: '08:00', end: '08:45' }, { day: 'الثلاثاء', start: '08:00', end: '08:45' }] },
  { id: 'demo-class-1', subject: 'رياضيات', title: 'الكسور والأعداد العشرية', teacher: 'رنا عادل', teacherId: 't-rana', grade: 'الخامس الأساسي', shift: 'صباحي', lessons: 20, students: 31, visibility: 'المدرسة', tone: 'neutral', schedule: [{ day: 'الاثنين', start: '09:00', end: '09:45' }, { day: 'الأربعاء', start: '09:00', end: '09:45' }] },
  { id: 'demo-class-2', subject: 'علوم', title: 'دورة الماء في الطبيعة', teacher: 'سمير فؤاد', teacherId: 't-samir', grade: 'الرابع الأساسي', shift: 'صباحي', lessons: 9, students: 26, visibility: 'عام', tone: 'accent', schedule: [{ day: 'الأحد', start: '10:00', end: '10:45' }] },
  { id: 'demo-class-3', subject: 'إنجليزي', title: 'Reading Foundations', teacher: 'هدى مالك', teacherId: 't-huda', grade: 'الرابع الأساسي', shift: 'مسائي', lessons: 16, students: 24, visibility: 'دعوة فقط', tone: 'outline', schedule: [{ day: 'الثلاثاء', start: '15:00', end: '15:45' }, { day: 'الخميس', start: '15:00', end: '15:45' }] },
  { id: 'demo-class-4', subject: 'تربية إسلامية', title: 'قصار السور', teacher: 'خالد الأحمد', teacherId: 't-khaled', grade: 'الخامس الأساسي', shift: 'صباحي', lessons: 12, students: 30, visibility: 'المدرسة', tone: 'neutral', schedule: [{ day: 'الأربعاء', start: '08:00', end: '08:45' }] },
  { id: 'demo-class-5', subject: 'فنون', title: 'الرسم والألوان', teacher: 'رنا عادل', teacherId: 't-rana', grade: 'كل الصفوف', shift: 'مسائي', lessons: 8, students: 22, visibility: 'عام', tone: 'accent', schedule: [{ day: 'الخميس', start: '16:00', end: '16:45' }] },
];

export const demoTeacherProfiles = [
  { id: 't-khaled', name: 'أ. خالد الأحمد', subject: 'اللغة العربية', bio: 'معلّم لغة عربية — 12 سنة خبرة', initial: 'خ', email: 'khaled@sulaimaniya.ps', phone: '0599 001 001' },
  { id: 't-rana', name: 'أ. رنا عادل', subject: 'الرياضيات والفنون', bio: 'معلّمة رياضيات وفنون', initial: 'ر', email: 'rana@sulaimaniya.ps', phone: '0599 002 002' },
  { id: 't-samir', name: 'أ. سمير فؤاد', subject: 'العلوم', bio: 'معلّم علوم ومسؤول المختبر', initial: 'س', email: 'samir@sulaimaniya.ps', phone: '0599 003 003' },
  { id: 't-huda', name: 'أ. هدى مالك', subject: 'اللغة الإنجليزية', bio: 'معلّمة لغة إنجليزية', initial: 'ه', email: 'huda@sulaimaniya.ps', phone: '0599 004 004' },
  { id: 't-reem', name: 'أ. ريم عوّاد', subject: 'الحاسوب والتقنية', bio: 'معلّمة حاسوب', initial: 'ر', email: 'reem@sulaimaniya.ps', phone: '0599 005 005' },
  { id: 't-majed', name: 'أ. ماجد سلامة', subject: 'التربية الرياضية', bio: 'معلّم تربية رياضية', initial: 'م', email: 'majed@sulaimaniya.ps', phone: '0599 006 006' },
];

export const demoArticles = [
  { title: 'انطلاق العام الدراسي 2026 / 2027', author: 'فاطمة (الإدارة)', category: 'أخبار', status: 'منشور', tone: 'accent', date: '2026-09-01' },
  { title: 'نتائج مسابقة القرآن الكريم', author: 'خالد الأحمد', category: 'إنجازات', status: 'قيد المراجعة', tone: 'outline', date: '2026-10-02' },
  { title: 'دليل أولياء الأمور للبوابة الإلكترونية', author: 'أحمد سعيد', category: 'إرشادات', status: 'مسودّة', tone: 'neutral', date: '2026-10-05' },
  { title: 'رحلة علمية إلى المتحف', author: 'سمير فؤاد', category: 'أنشطة', status: 'مجدول', tone: 'outline', date: '2026-10-12' },
  { title: 'تهنئة بعطلة نهاية الأسبوع', author: 'الإدارة', category: 'إعلان', status: 'منشور', tone: 'accent', date: '2026-10-06' },
];

export const demoAnnouncements = [
  { title: 'عطلة يوم الإثنين بمناسبة عيد الاستقلال', audience: 'الجميع', status: 'منشور', tone: 'accent', date: '2026-10-06' },
  { title: 'اجتماع أولياء أمور الصف الخامس', audience: 'الصف الخامس', status: 'مجدول', tone: 'outline', date: '2026-10-14' },
  { title: 'بدء تسليم الكتب المدرسية', audience: 'الجميع', status: 'منشور', tone: 'accent', date: '2026-09-03' },
  { title: 'تذكير: تسديد رسوم الفصل الأول', audience: 'أولياء الأمور', status: 'مسودّة', tone: 'neutral', date: '2026-10-08' },
];

export const demoComments = [
  { author: 'أم يوسف', on: 'انطلاق العام الدراسي', text: 'بالتوفيق لأبنائنا في عامهم الجديد', status: 'قيد المراجعة', tone: 'outline' },
  { author: 'زائر', on: 'رحلة علمية إلى متحف فلسطين', text: 'هل الرحلة متاحة لبقية الصفوف؟', status: 'قيد المراجعة', tone: 'outline' },
  { author: 'أبو سامي', on: 'تكريم الفائزين', text: 'مبروك للطلاب المتفوقين', status: 'معتمَد', tone: 'accent' },
  { author: 'مجهول', on: 'دليل أولياء الأمور', text: 'رابط لموقع خارجي غير مرغوب', status: 'محظور', tone: 'neutral' },
];

export const demoTeacherClasses = [
  { title: 'حروف المدّ والقراءة', meta: 'الصف الخامس / أ · 28 طالباً', done: 68, pending: '3 للمراجعة' },
  { title: 'قصار السور', meta: 'الصف الخامس / أ · 30 طالباً', done: 82, pending: '—' },
  { title: 'التعبير والإملاء', meta: 'الصف الرابع / ب · 26 طالباً', done: 54, pending: '5 للمراجعة' },
];

export const demoTeacherToReview = [
  { icon: 'fact_check', text: 'واجب «الإملاء الأسبوعي» — 5 تسليمات بانتظار التصحيح', cls: 'التعبير والإملاء' },
  { icon: 'checklist', text: 'اختبار «حروف المدّ» — 3 إجابات مفتوحة للتصحيح', cls: 'حروف المدّ' },
  { icon: 'schedule', text: 'درس «همزة القطع» مجدول للنشر الثلاثاء', cls: 'حروف المدّ' },
];

export const demoBuilderChapters = [
  { title: 'الوحدة 1 · مقدمة القراءة', lessons: [
    { t: 'الحروف الهجائية', state: 'منشور', tone: 'accent' },
    { t: 'الحركات القصيرة', state: 'منشور', tone: 'accent' },
  ] },
  { title: 'الوحدة 2 · حروف المدّ', lessons: [
    { t: 'مدّ الألف', state: 'منشور', tone: 'accent' },
    { t: 'مدّ الواو والياء', state: 'قيد التحرير', tone: 'outline' },
    { t: 'همزة القطع', state: 'مجدول · الثلاثاء', tone: 'neutral' },
  ] },
];

export const blockPalette = [
  { icon: 'title', label: 'عنوان' }, { icon: 'text_fields', label: 'نص منسّق' },
  { icon: 'image', label: 'صورة' }, { icon: 'format_list_bulleted', label: 'قائمة' },
  { icon: 'table_chart', label: 'جدول' }, { icon: 'attach_file', label: 'مرفق' },
  { icon: 'videocam', label: 'تضمين' }, { icon: 'co_present', label: 'شريحة' },
];

export const demoQuizTypes = [
  { icon: 'radio_button_checked', label: 'اختيار من متعدد', count: '6 أسئلة' },
  { icon: 'done_all', label: 'صح / خطأ', count: '4 أسئلة' },
  { icon: 'open_with', label: 'مطابقة بالسحب', count: 'نشاط' },
  { icon: 'edit', label: 'إجابة قصيرة', count: '2 أسئلة' },
  { icon: 'swap_vert', label: 'ترتيب', count: 'نشاط' },
  { icon: 'check_box_outline_blank', label: 'فراغات', count: 'نشاط' },
];

export const demoQuizPreview = {
  q: 'اختر الكلمة التي تحتوي على مدّ بالألف:',
  opts: [
    { t: 'كِتاب', correct: true }, { t: 'قَلَم', correct: false },
    { t: 'شمس', correct: false }, { t: 'بَحْر', correct: false },
  ],
  explanation: 'كلمة «كِتاب» فيها ألف مدّ بعد التاء المكسورة.',
};

export const demoObservations = [
  { student: 'يوسف الأحمد', kind: 'أكاديمي', sentiment: 'إيجابي', note: 'تحسّن ملحوظ في القراءة الجهرية هذا الأسبوع.', daysAgo: 0 },
  { student: 'كرم عبدالله', kind: 'سلوكي', sentiment: 'ملاحظة', note: 'يحتاج إلى تركيز أكبر أثناء النشاط الجماعي.', daysAgo: 1 },
  { student: 'مريم الخطيب', kind: 'اجتماعي', sentiment: 'إيجابي', note: 'تساعد زملاءها وتشارك بفعالية.', daysAgo: 2 },
  { student: 'عمر ناصر', kind: 'صحّي', sentiment: 'محايد', note: 'غادر مبكراً — موعد طبيب (بعلم الأهل).', daysAgo: 3 },
];

export const demoChildren = [
  { id: 's1', name: 'يوسف الأحمد', grade: 'الخامس / أ', initial: 'ي', dueMinorUnits: 12000, balanceMinorUnits: 12000, progress: 68, attend: 96, points: 1240 },
  { id: 's8', name: 'ليان الأحمد', grade: 'الروضة', initial: 'ل', dueMinorUnits: 0, balanceMinorUnits: 0, progress: 81, attend: 99, points: 640 },
];

/** Parent bank-transfer payment proofs awaiting / after staff review. */
export const demoPaymentProofs = [
  {
    id: 'pp1',
    studentId: 's1',
    studentName: 'يوسف الأحمد',
    guardianUid: 'parent-demo',
    guardianName: 'خالد الأحمد',
    amountMinorUnits: 40000,
    bankAccountName: 'مدرسة السليمانية — بنك فلسطين',
    payerName: 'خالد الأحمد',
    payerPhone: '0599-000-000',
    transferRef: 'TRX-8821',
    note: 'قسط الفصل الأول',
    receiptUrl: null,
    status: 'قيد المراجعة',
    daysAgo: 0,
  },
  {
    id: 'pp2',
    studentId: 's3',
    studentName: 'عمر ناصر',
    guardianUid: 'parent-2',
    guardianName: 'ناصر عمر',
    amountMinorUnits: 20000,
    bankAccountName: 'مدرسة السليمانية — بنك فلسطين',
    payerName: 'ناصر عمر',
    payerPhone: '0568-111-222',
    transferRef: 'BNK-4410',
    note: null,
    receiptUrl: null,
    status: 'معتمد',
    reviewedByName: 'ليلى حسن',
    daysAgo: 3,
  },
  {
    id: 'pp3',
    studentId: 's5',
    studentName: 'زيد الحوراني',
    guardianUid: 'parent-3',
    guardianName: 'محمود الحوراني',
    amountMinorUnits: 8000,
    bankAccountName: 'مدرسة السليمانية — بنك القدس',
    payerName: 'محمود الحوراني',
    payerPhone: '0592-333-444',
    transferRef: null,
    note: 'صورة غير واضحة',
    receiptUrl: null,
    status: 'مرفوض',
    rejectionReason: 'صورة الوصل غير واضحة — يُرجى إعادة الإرسال',
    reviewedByName: 'ليلى حسن',
    daysAgo: 5,
  },
];

export const demoParentFeed = [
  { icon: 'campaign', text: 'إعلان: عطلة رسمية يوم الخميس القادم', hoursAgo: 2 },
  { icon: 'receipt_long', text: 'تم استلام دفعتكم ₪ 400 — شكراً', hoursAgo: 24 },
  { icon: 'chat', text: 'ملاحظة إيجابية جديدة عن يوسف من أ. خالد', hoursAgo: 26 },
  { icon: 'workspace_premium', text: 'حصلت ليان على شارة «القارئ النشيط»', hoursAgo: 72 },
];

export const demoStudentClasses = [
  { title: 'حروف المدّ والقراءة', subject: 'لغة عربية', progress: 68, next: 'همزة القطع' },
  { title: 'الكسور والأعداد', subject: 'رياضيات', progress: 45, next: 'جمع الكسور' },
  { title: 'دورة الماء', subject: 'علوم', progress: 90, next: 'مراجعة الوحدة' },
];

export const demoStudentBadges = [
  { icon: 'menu_book', label: 'القارئ النشيط' }, { icon: 'star', label: 'نجم الأسبوع' },
  { icon: 'local_fire_department', label: 'مواظبة 7 أيام' }, { icon: 'gps_fixed', label: 'إتقان الوحدة' },
];

export const demoLeaderboard = [
  { rank: 1, name: 'مريم الخطيب', pts: 1480, me: false },
  { rank: 2, name: 'يوسف الأحمد', pts: 1240, me: true },
  { rank: 3, name: 'رهف سليمان', pts: 1190, me: false },
  { rank: 4, name: 'زيد الحوراني', pts: 1050, me: false },
];

export const demoPublicClasses = [
  {
    id: 'pub-class-0',
    subject: 'لغة عربية',
    title: 'حروف المدّ والقراءة',
    teacher: 'أ. خالد الأحمد',
    level: 'الصف الخامس',
    lessons: '14 درساً',
    shift: 'صباحي',
    students: 28,
    img: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=700&q=70',
    description: 'صف يركّز على القراءة الصحيحة وحروف المدّ والإملاء للصف الخامس. يتضمن تمارين صفّية ومتابعة أسبوعية.',
    schedule: [
      { day: 'الأحد', start: '08:00', end: '08:45' },
      { day: 'الثلاثاء', start: '08:00', end: '08:45' },
    ],
  },
  {
    id: 'pub-class-1',
    subject: 'علوم',
    title: 'دورة الماء في الطبيعة',
    teacher: 'أ. سمير فؤاد',
    level: 'الصف الرابع',
    lessons: '9 دروس',
    shift: 'صباحي',
    students: 26,
    img: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=700&q=70',
    description: 'مفاهيم التبخّر والتكاثف والهطول عبر تجارب بسيطة ومناقشات صفّية.',
    schedule: [{ day: 'الأحد', start: '10:00', end: '10:45' }],
  },
  {
    id: 'pub-class-2',
    subject: 'فنون',
    title: 'الرسم والألوان',
    teacher: 'أ. رنا عادل',
    level: 'كل الصفوف',
    lessons: '8 دروس',
    shift: 'مسائي',
    students: 22,
    img: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=700&q=70',
    description: 'ورشة فنون مفتوحة للطلاب: ألوان، خطوط، وتعبير بصري بسيط.',
    schedule: [{ day: 'الخميس', start: '16:00', end: '16:45' }],
  },
  {
    id: 'pub-class-3',
    subject: 'رياضيات',
    title: 'الكسور والأعداد العشرية',
    teacher: 'أ. رنا عادل',
    level: 'الصف الخامس',
    lessons: '20 درساً',
    shift: 'صباحي',
    students: 31,
    img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=700&q=70',
    description: 'بناء فهم الكسور والعمليات عليها مع أمثلة من الحياة اليومية.',
    schedule: [
      { day: 'الاثنين', start: '09:00', end: '09:45' },
      { day: 'الأربعاء', start: '09:00', end: '09:45' },
    ],
  },
  {
    id: 'pub-class-4',
    subject: 'تربية إسلامية',
    title: 'قصار السور وأحكام التلاوة',
    teacher: 'أ. خالد الأحمد',
    level: 'الصف الخامس',
    lessons: '12 درساً',
    shift: 'صباحي',
    students: 30,
    img: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=700&q=70',
    description: 'حفظ ومراجعة قصار السور مع أحكام تجويد أساسية مناسبة للمرحلة.',
    schedule: [{ day: 'الأربعاء', start: '08:00', end: '08:45' }],
  },
  {
    id: 'pub-class-5',
    subject: 'إنجليزي',
    title: 'Reading Foundations',
    teacher: 'أ. هدى مالك',
    level: 'الصف الرابع',
    lessons: '16 درساً',
    shift: 'مسائي',
    students: 24,
    img: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=700&q=70',
    description: 'تأسيس القراءة والكلمات الأساسية باللغة الإنجليزية للصف الرابع.',
    schedule: [
      { day: 'الثلاثاء', start: '15:00', end: '15:45' },
      { day: 'الخميس', start: '15:00', end: '15:45' },
    ],
  },
];

export const demoPublicFeatured = demoPublicClasses.slice(0, 3);

export const demoPublicArticles = [
  {
    id: 'pub-article-0',
    category: 'أخبار',
    title: 'انطلاق العام الدراسي 2026 / 2027',
    author: 'إدارة المدرسة',
    read: '3 دقائق',
    excerpt: 'بدأ الدوام يوم الأحد، واستقبلنا الطلاب في الساحة ثم توجهوا إلى صفوفهم.',
    body: 'بدأ العام الدراسي الجديد يوم الأحد بحضور الطلاب والمعلّمين. استُقبل الطلاب في الساحة الرئيسية ثم توجهوا إلى صفوفهم وفق الجداول المعتمدة.\n\nنذكّر أولياء الأمور بمتابعة الإعلانات عبر الموقع، وإكمال أي نواقص في ملفات التسجيل لدى مكتب القبول.',
    date: '1 أيلول',
    img: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=700&q=70',
  },
  {
    id: 'pub-article-1',
    category: 'إنجازات',
    title: 'تكريم الفائزين في مسابقة حفظ القرآن الكريم',
    author: 'أ. خالد الأحمد',
    read: '2 دقيقة',
    excerpt: 'تم تكريم الطلبة الفائزين في مسابقة الحفظ السنوية يوم الخميس في القاعة.',
    body: 'أقامت المدرسة حفل تكريم للفائزين في مسابقة حفظ القرآن الكريم السنوية داخل القاعة.\n\nتم توزيع شهادات التقدير على الطلبة الفائزين بحضور أولياء الأمور وهيئة التدريس. نشكر المشاركين وندعو للمزيد من المشاركة في المسابقات القادمة.',
    date: '2 تشرين الأول',
    img: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=700&q=70',
  },
  {
    id: 'pub-article-2',
    category: 'أنشطة',
    title: 'رحلة علمية إلى متحف فلسطين',
    author: 'أ. سمير فؤاد',
    read: '4 دقائق',
    excerpt: 'طلاب الصف الخامس زاروا المتحف ضمن نشاط العلوم. التفاصيل عند المعلّم.',
    body: 'نُظّمت رحلة علمية لطلاب الصف الخامس إلى متحف فلسطين ضمن نشاط مادة العلوم.\n\nتعرّف الطلاب على معروضات تتعلق بالبيئة والتاريخ المحلي، وكتبوا ملاحظات قصيرة كجزء من النشاط الصفّي. للاستفسار عن الصور أو التقرير يمكن مراجعة معلّم العلوم.',
    date: '12 تشرين الأول',
    img: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=700&q=70',
  },
  {
    id: 'pub-article-3',
    category: 'إرشادات',
    title: 'كيف تدخل حساب ولي الأمر',
    author: 'مكتب القبول',
    read: '5 دقائق',
    excerpt: 'ادخل برقم الجوال المسجّل. من الحساب تشوف الرسوم والدرجات والحضور.',
    body: 'للدخول إلى حساب ولي الأمر استخدم رقم الجوال المسجّل لدى المدرسة وكلمة المرور المرسلة إليك.\n\nمن الحساب يمكنك متابعة الرسوم والدرجات والحضور والإعلانات. إذا واجهت مشكلة في الدخول راجع مكتب القبول خلال دوام الاستقبال.',
    date: '5 تشرين الأول',
    img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=700&q=70',
  },
  {
    id: 'pub-article-4',
    category: 'مناسبات',
    title: 'فعالية يوم الأرض',
    author: 'إدارة المدرسة',
    read: '3 دقائق',
    excerpt: 'أقيمت فعالية في الساحة: معرض رسم وأناشيد. شكراً للمشاركين.',
    body: 'أحيت المدرسة يوم الأرض بفعالية في الساحة شملت معرض رسم وأناشيد طلابية.\n\nنشكر الطلاب والمعلّمين وأولياء الأمور على المشاركة، وندعو للحفاظ على نظافة الساحة والمرافق بعد الفعاليات.',
    date: '30 آذار',
    img: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=700&q=70',
  },
];

export const contactInfo = {
  addr: 'غزة، الرمال — فلسطين · حي الرمال',
  phone: '0599 123 456',
  email: 'info@sulaimaniya.ps',
};

export const heroImg = 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=900&q=70';

const SUBJECT_IMAGES = {
  'لغة عربية': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=700&q=70',
  'رياضيات': 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=700&q=70',
  'علوم': 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=700&q=70',
  'إنجليزي': 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=700&q=70',
  'تربية إسلامية': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=700&q=70',
  'فنون': 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=700&q=70',
};
export const imageForSubject = (subject) => SUBJECT_IMAGES[subject] || SUBJECT_IMAGES['لغة عربية'];

export const schoolStats = { students: 842, teachers: 36, years: 18 };

export const demoStaffUsers = [
  { id: 'u-fatima', name: 'فاطمة (المالكة)', role: 'admin', title: 'مدير عام', email: 'admin@sulaimaniya.ps', permissions: {} },
  { id: 'u-khaled', name: 'أ. خالد الأحمد', role: 'teacher', title: 'معلّم لغة عربية', email: 'khaled@sulaimaniya.ps', permissions: { 'classes.manage': true } },
  { id: 'u-rana', name: 'أ. رنا عادل', role: 'teacher', title: 'معلّمة رياضيات', email: 'rana@sulaimaniya.ps', permissions: { 'classes.manage': true } },
  { id: 'u-layla', name: 'ليلى حسن', role: 'accountant', title: 'مسؤولة مالية', email: 'layla@sulaimaniya.ps', permissions: { 'billing.manage': true, 'payments.manage': true, 'expenses.manage': true, 'enrollment.manage': true, 'students.manage': true, 'payroll.manage': true, 'disbursements.manage': true } },
];

export const demoEnrollments = {
  'demo-class-0': [
    { studentId: 's1', studentName: 'يوسف الأحمد', displayId: 'STU-1042', grade: 'الخامس / أ' },
    { studentId: 's4', studentName: 'رهف سليمان', displayId: 'STU-0771', grade: 'الثالث / أ' },
  ],
  'demo-class-1': [
    { studentId: 's2', studentName: 'مريم الخطيب', displayId: 'STU-0987', grade: 'الرابع / ب' },
  ],
};

// Flat daily attendance log per student — the same shape real Firestore
// writes into students/{id}/attendanceRecords. Aggregated into the
// monthly summary table client-side via computeMonthlyAttendance().
export const demoAttendanceRecords = {
  s1: [
    { date: '2026-09-02', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', status: 'حاضر' },
    { date: '2026-09-07', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', status: 'حاضر' },
    { date: '2026-09-09', classId: 'demo-class-4', className: 'قصار السور', subject: 'تربية إسلامية', status: 'حاضر' },
    { date: '2026-09-14', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', status: 'غائب' },
    { date: '2026-09-16', classId: 'demo-class-4', className: 'قصار السور', subject: 'تربية إسلامية', status: 'حاضر' },
    { date: '2026-09-21', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', status: 'حاضر' },
    { date: '2026-10-05', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', status: 'حاضر' },
    { date: '2026-10-07', classId: 'demo-class-4', className: 'قصار السور', subject: 'تربية إسلامية', status: 'متأخر' },
    { date: '2026-10-12', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', status: 'حاضر' },
    { date: '2026-10-19', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', status: 'مستأذن' },
    { date: '2026-10-21', classId: 'demo-class-4', className: 'قصار السور', subject: 'تربية إسلامية', status: 'حاضر' },
    { date: '2026-10-26', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', status: 'حاضر' },
  ],
};

// Per-class attendance history (what a teacher already took, what admin
// browses from a class's detail page) — the same shape as
// classes/{id}/attendanceSessions/{date}.
export const demoAttendanceSessions = {
  'demo-class-0': [
    { date: '2026-10-26', takenByName: 'أ. خالد الأحمد', records: { s1: { studentName: 'يوسف الأحمد', status: 'حاضر' }, s4: { studentName: 'رهف سليمان', status: 'حاضر' } } },
    { date: '2026-10-19', takenByName: 'أ. خالد الأحمد', records: { s1: { studentName: 'يوسف الأحمد', status: 'مستأذن' }, s4: { studentName: 'رهف سليمان', status: 'حاضر' } } },
    { date: '2026-10-12', takenByName: 'أ. خالد الأحمد', records: { s1: { studentName: 'يوسف الأحمد', status: 'حاضر' }, s4: { studentName: 'رهف سليمان', status: 'غائب' } } },
  ],
};

export const demoGradeEntries = [
  { id: 'g1', studentId: 's1', studentName: 'يوسف الأحمد', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', teacherId: 't-khaled', teacherName: 'أ. خالد الأحمد', assessmentTitle: 'اختبار الوحدة الثانية', score: 88, maxScore: 100, status: 'قيد المراجعة' },
  { id: 'g2', studentId: 's4', studentName: 'رهف سليمان', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', teacherId: 't-khaled', teacherName: 'أ. خالد الأحمد', assessmentTitle: 'واجب الإملاء الأسبوعي', score: 19, maxScore: 20, status: 'قيد المراجعة' },
  { id: 'g3', studentId: 's2', studentName: 'مريم الخطيب', classId: 'demo-class-1', className: 'الكسور والأعداد العشرية', subject: 'رياضيات', teacherId: 't-rana', teacherName: 'أ. رنا عادل', assessmentTitle: 'اختبار منتصف الفصل', score: 95, maxScore: 100, status: 'معتمد' },
  { id: 'g4', studentId: 's1', studentName: 'يوسف الأحمد', classId: 'demo-class-0', className: 'حروف المدّ والقراءة', subject: 'لغة عربية', teacherId: 't-khaled', teacherName: 'أ. خالد الأحمد', assessmentTitle: 'مشاركة صفّية', score: 40, maxScore: 50, status: 'مرفوض' },
  { id: 'g5', studentId: 's1', studentName: 'يوسف الأحمد', classId: 'demo-class-4', className: 'قصار السور', subject: 'تربية إسلامية', teacherId: 't-khaled', teacherName: 'أ. خالد الأحمد', assessmentTitle: 'اختبار الحفظ', score: 47, maxScore: 50, status: 'معتمد' },
];

export const demoActivityLog = [
  { id: 'a1', type: 'student_created', actorName: 'أحمد (السكرتارية)', actorRole: 'admin', summary: 'تسجيل طالب جديد: سارة العلي — الصف الثالث', hoursAgo: 0.2 },
  { id: 'a2', type: 'grade_submitted', actorName: 'أ. خالد الأحمد', actorRole: 'teacher', summary: 'رصد درجة «اختبار الوحدة الثانية» ليوسف الأحمد', hoursAgo: 1 },
  { id: 'a3', type: 'invoice_generated', actorName: 'ليلى حسن', actorRole: 'accountant', summary: 'رفع فاتورة رسوم دراسية — يوسف الأحمد', hoursAgo: 3 },
  { id: 'a4', type: 'grade_approved', actorName: 'فاطمة (المالكة)', actorRole: 'admin', summary: 'اعتماد درجة «اختبار منتصف الفصل» لمريم الخطيب', hoursAgo: 26 },
  { id: 'a5', type: 'enrollment_added', actorName: 'ليلى حسن', actorRole: 'accountant', summary: 'تسجيل مريم الخطيب في صفّ الكسور والأعداد العشرية', hoursAgo: 30 },
];

/** Discounts / waivers register for fee-aid screen demo. */
export const demoStudentDiscounts = [
  {
    id: 'd1', studentId: 's1', studentName: 'يوسف الأحمد', amountMinorUnits: 10000,
    kind: 'sibling', kindLabel: 'خصم إخوة', mode: 'amount', reason: 'أخ في الروضة',
    reference: 'قرار-12', academicYear: '2026 / 2027', status: 'مفعّل',
    createdByName: 'ليلى حسن', daysAgo: 2,
  },
  {
    id: 'd2', studentId: 's3', studentName: 'عمر ناصر', amountMinorUnits: 20000,
    kind: 'hardship', kindLabel: 'إعفاء إنساني', mode: 'amount', reason: 'عائلة نازحة — ظرف طارئ',
    reference: 'لجنة-03', notes: 'موافقة الإدارة', academicYear: '2026 / 2027', status: 'مفعّل',
    createdByName: 'فاطمة (المالكة)', daysAgo: 5,
  },
  {
    id: 'd3', studentId: 's7', studentName: 'كرم عبدالله', amountMinorUnits: 15000,
    kind: 'grant', kindLabel: 'منحة', mode: 'percent', percent: 25, reason: 'منحة متفوقين',
    academicYear: '2026 / 2027', status: 'مفعّل', createdByName: 'ليلى حسن', daysAgo: 12,
  },
];

export const demoInstallmentPlans = [
  {
    id: 'plan1', studentId: 's3', studentName: 'عمر ناصر', totalMinorUnits: 60000,
    months: 3, installmentMinorUnits: 20000, startPeriod: '2026-09', status: 'نشط',
    notes: 'تقسيط رسوم الفصل الأول', academicYear: '2026 / 2027', paidCount: 1, createdByName: 'ليلى حسن', daysAgo: 8,
  },
  {
    id: 'plan2', studentId: 's7', studentName: 'كرم عبدالله', totalMinorUnits: 40000,
    months: 4, installmentMinorUnits: 10000, startPeriod: '2026-10', status: 'نشط',
    academicYear: '2026 / 2027', paidCount: 0, createdByName: 'ليلى حسن', daysAgo: 3,
  },
];

export const demoInstallments = [
  { id: 'i1', planId: 'plan1', studentId: 's3', studentName: 'عمر ناصر', index: 1, ofTotal: 3, amountMinorUnits: 20000, period: '2026-09', status: 'مدفوع' },
  { id: 'i2', planId: 'plan1', studentId: 's3', studentName: 'عمر ناصر', index: 2, ofTotal: 3, amountMinorUnits: 20000, period: '2026-10', status: 'مستحق' },
  { id: 'i3', planId: 'plan1', studentId: 's3', studentName: 'عمر ناصر', index: 3, ofTotal: 3, amountMinorUnits: 20000, period: '2026-11', status: 'مجدول' },
  { id: 'i4', planId: 'plan2', studentId: 's7', studentName: 'كرم عبدالله', index: 1, ofTotal: 4, amountMinorUnits: 10000, period: '2026-10', status: 'مستحق' },
  { id: 'i5', planId: 'plan2', studentId: 's7', studentName: 'كرم عبدالله', index: 2, ofTotal: 4, amountMinorUnits: 10000, period: '2026-11', status: 'مجدول' },
  { id: 'i6', planId: 'plan2', studentId: 's7', studentName: 'كرم عبدالله', index: 3, ofTotal: 4, amountMinorUnits: 10000, period: '2026-12', status: 'مجدول' },
  { id: 'i7', planId: 'plan2', studentId: 's7', studentName: 'كرم عبدالله', index: 4, ofTotal: 4, amountMinorUnits: 10000, period: '2027-01', status: 'مجدول' },
];
