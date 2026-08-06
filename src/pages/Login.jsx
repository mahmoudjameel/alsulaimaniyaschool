import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import Icon from '../components/Icon';
import PhoneWhatsAppField from '../components/PhoneWhatsAppField';
import { useAuth } from '../context/AuthContext';
import { auth as firebaseAuth, db } from '../firebase/config';
import {
  SCHOOL_EMAIL_DOMAIN, SCHOOL_LOCATION_AR, SCHOOL_NAME_AR, SCHOOL_NAME_EN, SCHOOL_TYPE_AR,
  SHOW_FAMILY_PORTALS,
} from '../lib/constants';
import { isValidLocalMobile, toE164Display } from '../lib/phone';

const ALL_ROLE_TABS = [
  { id: 'admin', label: 'الإدارة', icon: 'dashboard' },
  { id: 'director', label: 'المديرة', icon: 'manage_accounts' },
  { id: 'teacher', label: 'المعلّم', icon: 'co_present' },
  { id: 'accountant', label: 'المحاسب', icon: 'point_of_sale' },
  { id: 'reception', label: 'الاستقبال', icon: 'desk' },
  { id: 'parent', label: 'ولي الأمر', icon: 'family_restroom', family: true },
  { id: 'student', label: 'الطالب', icon: 'school', family: true },
];

const ROLE_TABS = ALL_ROLE_TABS.filter((r) => SHOW_FAMILY_PORTALS || !r.family);

const STAFF_ROLES = new Set(['admin', 'director', 'teacher', 'accountant', 'reception']);

const META = {
  admin: { title: 'لوحة الإدارة', sub: 'دخول حساب الإدارة', ph: `admin@${SCHOOL_EMAIL_DOMAIN}`, idLabel: 'البريد الإلكتروني', hint: 'يتطلّب كلمة مرور' },
  director: { title: 'دخول المديرة', sub: 'لوحة الإدارة بصلاحيات مخصّصة', ph: `director@${SCHOOL_EMAIL_DOMAIN}`, idLabel: 'البريد الإلكتروني', hint: 'يتطلّب كلمة مرور' },
  teacher: { title: 'دخول المعلّم', sub: 'صفوفك والحضور والدرجات', ph: `teacher@${SCHOOL_EMAIL_DOMAIN}`, idLabel: 'البريد الإلكتروني', hint: 'يتطلّب كلمة مرور' },
  accountant: { title: 'دخول المحاسب', sub: 'الفواتير والمدفوعات والرواتب', ph: `accountant@${SCHOOL_EMAIL_DOMAIN}`, idLabel: 'البريد الإلكتروني', hint: 'يتطلّب كلمة مرور' },
  reception: { title: 'دخول الاستقبال', sub: 'القبول وملفات الطلاب', ph: `reception@${SCHOOL_EMAIL_DOMAIN}`, idLabel: 'البريد الإلكتروني', hint: 'يتطلّب كلمة مرور' },
  parent: { title: 'دخول ولي الأمر', sub: 'برقم الجوال المسجّل لدى المدرسة', ph: '0592 799 888', idLabel: 'رقم الجوال', hint: 'بدون كلمة مرور' },
  student: { title: 'دخول الطالب', sub: 'بالرقم الدراسي فقط', ph: '1227', idLabel: 'الرقم الدراسي', hint: 'بدون كلمة مرور' },
};

const DEST = {
  admin: '/admin',
  director: '/admin',
  teacher: '/teacher',
  accountant: '/accountant',
  reception: '/reception',
  parent: '/parent',
  student: '/student',
};

/** Tab role → accepted profile roles (admin shell shares admin/director). */
const TAB_ALLOWED_ROLES = {
  admin: ['admin', 'director'],
  director: ['admin', 'director'],
  teacher: ['teacher'],
  accountant: ['accountant'],
  reception: ['reception'],
  parent: ['parent'],
  student: ['student'],
};

const SIGN_IN_FN = {
  admin: 'signInAdmin',
  director: 'signInAdmin',
  teacher: 'signInTeacher',
  accountant: 'signInAccountant',
  reception: 'signInReception',
  parent: 'signInParent',
  student: 'signInStudent',
};

export default function Login() {
  const { role: routeRole } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    if (!SHOW_FAMILY_PORTALS && (routeRole === 'parent' || routeRole === 'student')) {
      navigate('/', { replace: true });
    }
  }, [routeRole, navigate]);

  const role = ROLE_TABS.some((r) => r.id === routeRole) ? routeRole : 'admin';
  const needsPassword = STAFF_ROLES.has(role);

  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [phoneDial, setPhoneDial] = useState('970');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const meta = META[role];

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!auth.isFirebaseConfigured) {
      navigate(DEST[role]);
      return;
    }

    let identifier = id.trim();
    if (role === 'parent') {
      if (!isValidLocalMobile(phoneLocal)) {
        setError('أدخل رقم جوال صحيح يبدأ بـ 05 ويتكوّن من 10 أرقام.');
        return;
      }
      identifier = toE164Display(phoneDial, phoneLocal) || phoneLocal;
    }
    if (role === 'student') {
      const digits = identifier.replace(/\D/g, '');
      if (!digits || digits.length < 3) {
        setError('أدخل الرقم الدراسي (الأرقام فقط)، مثل 1227.');
        return;
      }
      identifier = digits; // server adds STU- prefix
    }
    if (needsPassword && !password) {
      setError('أدخل كلمة المرور.');
      return;
    }

    setSubmitting(true);
    try {
      await auth[SIGN_IN_FN[role]](identifier, password, remember);
      if (auth.isFirebaseConfigured) {
        const uid = firebaseAuth.currentUser?.uid;
        if (!uid) throw new Error('no-user');
        const snap = await getDoc(doc(db, 'users', uid));
        const actualRole = snap.exists() ? snap.data()?.role : null;
        const allowed = TAB_ALLOWED_ROLES[role] || [role];
        if (!actualRole || !allowed.includes(actualRole)) {
          await auth.signOut();
          setError('هذا الحساب لا ينتمي لهذا المدخل. اختري الواجهة المناسبة لدورك.');
          return;
        }
        navigate(DEST[actualRole] || DEST[role]);
      } else {
        navigate(DEST[role]);
      }
    } catch (err) {
      setError(mapAuthError(err, role));
    } finally {
      setSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    if (!needsPassword) return;
    if (!id) { setError('أدخل بريدك الإلكتروني أولاً ثم اضغط «نسيت كلمة المرور»'); return; }
    try {
      await auth.resetPassword(id);
      setResetSent(true);
    } catch (err) {
      setError(mapAuthError(err, role));
    }
  };

  const resetForm = () => {
    setError('');
    setResetSent(false);
    setId('');
    setPassword('');
    setPhoneLocal('');
    setPhoneDial('970');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }} className="ah-login">
      <div className="ah-login-aside" style={{ position: 'relative', padding: '56px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--color-neutral-900)', color: 'var(--color-bg)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.12 }}>
          <div style={{ position: 'absolute', top: -100, insetInlineEnd: -80, width: 380, height: 380, border: '1px solid var(--gold)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', top: -40, insetInlineEnd: -20, width: 260, height: 260, border: '1px solid var(--gold)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: -120, insetInlineStart: -100, width: 420, height: 420, border: '1px solid var(--gold)', borderRadius: '50%' }} />
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--color-bg)', display: 'grid', placeItems: 'center', flex: 'none', boxShadow: 'var(--shadow-sm)' }}>
            <img src="/assets/logo-mark.png" alt={`شعار ${SCHOOL_NAME_AR}`} style={{ width: 44, height: 44, objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{SCHOOL_NAME_AR}</div>
            <div style={{ fontSize: 11, letterSpacing: '.3em', color: 'var(--gold)', marginTop: 3 }}>{SCHOOL_NAME_EN.replace(/ /g, '\u00a0')}</div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 38, lineHeight: 1.2, fontWeight: 700, maxWidth: 420 }}>{SCHOOL_NAME_AR}</div>
          <p style={{ fontSize: 15, lineHeight: 1.9, color: 'var(--color-neutral-300)', maxWidth: 400, marginTop: 16 }}>
            {SCHOOL_TYPE_AR} · {SCHOOL_LOCATION_AR}
          </p>
        </div>
        <div style={{ position: 'relative', fontSize: 12, color: 'var(--color-neutral-400)' }}>{SCHOOL_TYPE_AR} · {SCHOOL_LOCATION_AR}</div>
      </div>

      <div className="ah-login-formwrap" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 48, position: 'relative' }}>
        <Link to="/" className="btn btn-ghost" style={{ position: 'absolute', top: 24, insetInlineStart: 24, fontSize: 13 }}>
          <Icon name="arrow_forward" size={15} /> كل الواجهات
        </Link>
        <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
          <div className="seg ah-roletabs" style={{ display: 'grid', gridTemplateColumns: `repeat(${ROLE_TABS.length},minmax(0,1fr))`, marginBottom: 28 }}>
            {ROLE_TABS.map((r) => (
              <button
                key={r.id}
                className="ah-roletab"
                data-active={role === r.id}
                onClick={() => { resetForm(); navigate(`/login/${r.id}`); }}
                type="button"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 4px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-neutral-600)', borderBottom: '2px solid transparent' }}
              >
                <Icon name={r.icon} size={20} />{r.label}
              </button>
            ))}
          </div>

          <h2 style={{ margin: '0 0 4px', fontSize: 28 }}>{meta.title}</h2>
          <p style={{ color: 'var(--color-neutral-600)', fontSize: 14, margin: '0 0 24px' }}>{meta.sub}</p>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {role === 'parent' ? (
              <PhoneWhatsAppField
                dialCode={phoneDial}
                localPhone={phoneLocal}
                onDialChange={setPhoneDial}
                onLocalChange={setPhoneLocal}
                label="رقم الجوال المسجّل"
                required
              />
            ) : role === 'student' ? (
              <div className="field">
                <label>{meta.idLabel}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 8 }}>
                  <div
                    className="input"
                    style={{
                      display: 'grid', placeItems: 'center', fontWeight: 700, color: 'var(--color-neutral-600)',
                      background: 'var(--color-neutral-100)', pointerEvents: 'none',
                    }}
                    aria-hidden
                  >
                    STU-
                  </div>
                  <input
                    className="input"
                    placeholder={meta.ph}
                    dir="ltr"
                    style={{ textAlign: 'left' }}
                    value={id}
                    onChange={(e) => setId(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="الرقم الدراسي بدون البادئة"
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 6 }}>
                  اكتب الأرقام فقط — لا حاجة لكتابة STU-
                </div>
              </div>
            ) : (
              <div className="field">
                <label>{meta.idLabel}</label>
                <input className="input" placeholder={meta.ph} dir="ltr" style={{ textAlign: 'right' }} value={id} onChange={(e) => setId(e.target.value)} required autoComplete={needsPassword ? 'username' : 'off'} />
              </div>
            )}

            {needsPassword && (
              <div className="field">
                <label>كلمة المرور</label>
                <input className="input" type="password" placeholder="••••••••" dir="ltr" style={{ textAlign: 'right' }} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="radio" style={{ margin: 0 }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span className="dot" /> تذكّرني
              </label>
              {needsPassword && (
                <button type="button" onClick={onForgotPassword} className="ah-tablink" style={{ fontSize: 13, color: 'var(--gold)' }}>نسيت كلمة المرور؟</button>
              )}
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--color-accent-2-700)' }}>{error}</div>}
            {resetSent && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>أُرسل رابط إعادة التعيين إلى بريدك الإلكتروني.</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'جارٍ الدخول…' : needsPassword ? 'تسجيل الدخول' : 'دخول'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', background: 'var(--color-accent-100)' }}>
            <Icon name="info" size={18} color="var(--color-accent-800)" />
            <span style={{ fontSize: 12, color: 'var(--color-accent-900)' }}>{meta.hint}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function mapAuthError(err, role) {
  const code = err?.code || '';
  const msg = err?.message || '';
  if (code === 'functions/not-found' || msg.includes('not-found')) {
    return role === 'parent'
      ? 'لا يوجد أبناء مرتبطون بهذا الرقم. تأكد من الجوال المسجّل لدى المدرسة.'
      : 'الرقم الدراسي غير موجود.';
  }
  if (code === 'functions/invalid-argument' || msg.includes('invalid-argument')) {
    return role === 'parent' ? 'أدخل رقم جوال صحيح مثل 0592799888.' : 'أدخل الرقم الدراسي (مثل 1227).';
  }
  if (code.includes('user-not-found') || code.includes('invalid-credential') || code.includes('wrong-password')) {
    return 'بيانات الدخول غير صحيحة. تحقّق من البريد وكلمة المرور.';
  }
  if (code.includes('too-many-requests')) return 'محاولات كثيرة — حاول لاحقاً.';
  if (code.includes('network-request-failed')) return 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت.';
  if (/internal/i.test(code) || /^INTERNAL$/i.test(msg.trim()) || msg.includes('INTERNAL')) {
    return 'تعذّر تسجيل الدخول حالياً. حاول مجدداً بعد لحظات.';
  }
  if (code.includes('functions/')) {
    const cleaned = msg.replace(/^Firebase:\s*/i, '').replace(/^[^:]+:\s*/, '').trim();
    if (!cleaned || /^INTERNAL$/i.test(cleaned)) return 'تعذّر تسجيل الدخول حالياً. حاول مجدداً.';
    return cleaned;
  }
  return 'حدث خطأ أثناء تسجيل الدخول. حاول مجدداً.';
}
