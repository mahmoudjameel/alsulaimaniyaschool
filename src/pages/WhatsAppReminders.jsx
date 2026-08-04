import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../components/Icon';
import BackButton from '../components/BackButton';
import { staffPortalBase } from '../lib/portalPaths';
import { EmptyRow, ErrorBanner, Field } from '../components/ui';
import { useLiveOrDemo } from '../hooks/useFirestore';
import { useAuth } from '../context/AuthContext';
import { SCHOOL_NAME_AR, formatILS } from '../lib/constants';
import {
  ABSENCE_REMINDER_TEMPLATE, FEE_REMINDER_TEMPLATE, GENERAL_MESSAGE_TEMPLATE,
  formatPhoneDisplay, openWhatsAppChat, parseStoredPhone, toWhatsAppNumber,
} from '../lib/phone';
import { demoStudents } from '../data/demo';
import { matchesStudentSearch } from '../lib/studentSearch';
import SearchInput from '../components/SearchInput';

const MODES = [
  { id: 'arrears', label: 'مستحقات رسوم' },
  { id: 'all', label: 'كل أولياء الأمور' },
  { id: 'custom', label: 'رسالة عامة' },
];

export default function WhatsAppReminders() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const { data: students, error, demo } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const [mode, setMode] = useState('arrears');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [customText, setCustomText] = useState(GENERAL_MESSAGE_TEMPLATE(SCHOOL_NAME_AR, ''));
  const [queueIndex, setQueueIndex] = useState(-1);
  const [lastOpened, setLastOpened] = useState('');

  const rows = useMemo(() => {
    const list = (students || [])
      .filter((s) => s.status !== 'متخرّج' && s.status !== 'منسحب')
      .map((s) => {
        const parsed = parseStoredPhone(s);
        const wa = toWhatsAppNumber(parsed.dialCode, parsed.local);
        const balance = Number(s.balanceMinorUnits || 0);
        return {
          ...s,
          dialCode: parsed.dialCode,
          local: parsed.local,
          wa,
          phoneLabel: wa ? formatPhoneDisplay(parsed.dialCode, parsed.local) : (s.guardianPhone || s.phone || '—'),
          balance,
        };
      })
      .filter((s) => {
        if (mode === 'arrears') return s.balance > 0;
        return true;
      })
      .filter((s) => matchesStudentSearch(s, search));
    return list;
  }, [students, mode, search]);

  const selectedRows = rows.filter((r) => selected[r.id] && r.wa);
  const withWhatsApp = rows.filter((r) => r.wa);
  const withoutWhatsApp = rows.filter((r) => !r.wa);

  const messageFor = (s) => {
    if (mode === 'arrears') {
      return FEE_REMINDER_TEMPLATE(SCHOOL_NAME_AR, s.name, formatILS(s.balance));
    }
    if (mode === 'custom' || mode === 'all') {
      return customText
        .replaceAll('{student}', s.name || '')
        .replaceAll('{guardian}', s.guardianName || '')
        .replaceAll('{amount}', formatILS(s.balance));
    }
    return ABSENCE_REMINDER_TEMPLATE(SCHOOL_NAME_AR, s.name, '');
  };

  const toggle = (id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  const selectAllValid = () => {
    const next = {};
    withWhatsApp.forEach((r) => { next[r.id] = true; });
    setSelected(next);
  };
  const clearSel = () => setSelected({});

  const openOne = (s) => {
    const ok = openWhatsAppChat(s, messageFor(s));
    if (ok) setLastOpened(s.name);
    return ok;
  };

  const startQueue = () => {
    if (selectedRows.length === 0) return;
    setQueueIndex(0);
    openOne(selectedRows[0]);
  };

  const openNext = () => {
    const next = queueIndex + 1;
    if (next >= selectedRows.length) {
      setQueueIndex(-1);
      setLastOpened('انتهى الطابور');
      return;
    }
    setQueueIndex(next);
    openOne(selectedRows[next]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to={staffPortalBase(pathname)} label="رجوع" />
      <ErrorBanner>{error && 'تعذّر تحميل الطلاب.'}</ErrorBanner>

      <div className="card" style={{ gap: 10, background: 'var(--color-accent-100)', borderColor: 'color-mix(in srgb, var(--gold) 40%, transparent)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700 }}>تذكير واتساب</div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: 'var(--color-neutral-700)' }}>
          يفتح واتساب على جهازك برقم ولي الأمر المسجّل. اختر الأسماء ثم أرسل الرسالة من واتسابك.
          {profile?.name ? ` المرسل: ${profile.name}` : ''}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`btn ${mode === m.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 13 }}
            onClick={() => { setMode(m.id); setQueueIndex(-1); }}
          >
            {m.label}
          </button>
        ))}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث: اسم / هوية / رقم دراسي…"
          style={{ marginInlineStart: 'auto', maxWidth: 300 }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
          {withWhatsApp.length} رقم جاهز · {withoutWhatsApp.length} بلا رقم صالح
          {demo ? ' · وضع تجريبي' : ''}
        </span>
      </div>

      {(mode === 'custom' || mode === 'all') && (
        <Field label="نص الرسالة (يمكنك استخدام {student} و {guardian} و {amount})">
          <textarea className="input" rows={5} value={customText} onChange={(e) => setCustomText(e.target.value)} />
        </Field>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={selectAllValid}>تحديد الكل الجاهز</button>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={clearSel}>مسح التحديد</button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: 13 }}
          disabled={selectedRows.length === 0}
          onClick={startQueue}
        >
          <Icon name="chat" size={15} /> ابدأ الإرسال ({selectedRows.length})
        </button>
        {queueIndex >= 0 && (
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={openNext}>
            التالي ({queueIndex + 1}/{selectedRows.length})
          </button>
        )}
        {lastOpened && <span style={{ fontSize: 12, color: 'var(--color-accent-700)', alignSelf: 'center' }}>آخر فتح: {lastOpened}</span>}
      </div>

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 40 }} />
              <th>الطالب</th>
              <th>ولي الأمر</th>
              <th>واتساب</th>
              <th>المستحق</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={6}>لا يوجد أولياء مطابقون لهذا التصفية.</EmptyRow>}
            {rows.map((s) => (
              <tr key={s.id} style={{ opacity: s.wa ? 1 : 0.55 }}>
                <td>
                  <input
                    type="checkbox"
                    disabled={!s.wa}
                    checked={!!selected[s.id]}
                    onChange={() => toggle(s.id)}
                    aria-label={`تحديد ${s.name}`}
                  />
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{s.grade}</div>
                </td>
                <td>{s.guardianName || '—'}</td>
                <td className="ah-tabnum" dir="ltr" style={{ textAlign: 'right' }}>{s.phoneLabel}</td>
                <td className="ah-tabnum">{s.balance > 0 ? formatILS(s.balance) : '—'}</td>
                <td style={{ textAlign: 'left' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    disabled={!s.wa}
                    onClick={() => openOne(s)}
                  >
                    فتح واتساب
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
