import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { ErrorBanner, SegmentedTabs } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { SCHOOL_DAYS, slotsForDay, todaySchoolDay, weekSlotsByDay } from '../../lib/schedule';

const TABS = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'الأسبوع' },
];

function SlotCard({ row }) {
  return (
    <div className="card" style={{ gap: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{row.title}</div>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 4 }}>
            {[row.subject, row.grade, row.shift].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="ah-tabnum" style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 700 }} dir="ltr">
          {row.start}{row.end ? ` – ${row.end}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to={`/teacher/attendance?class=${row.classId}`} className="btn btn-primary" style={{ fontSize: 12, textDecoration: 'none' }}>
          حضور
        </Link>
        <Link to={`/teacher/diary?class=${row.classId}`} className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>
          دفتر اليوم
        </Link>
        <Link to={`/teacher/classes/${row.classId}`} className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>
          الطلاب
        </Link>
      </div>
    </div>
  );
}

export default function TeacherSchedule() {
  const { myClasses, error, demo } = useMyClasses();
  const [tab, setTab] = useState('today');
  const today = todaySchoolDay();
  const todaySlots = useMemo(() => slotsForDay(myClasses, today), [myClasses, today]);
  const week = useMemo(() => weekSlotsByDay(myClasses), [myClasses]);
  const hasAnySchedule = useMemo(
    () => (myClasses || []).some((c) => Array.isArray(c.schedule) && c.schedule.length > 0),
    [myClasses],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الجدول.'}</ErrorBanner>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
          حصصك حسب جدول الصفوف المسندة إليك.
          {demo ? ' (عرض توضيحي)' : ''}
        </p>
        <SegmentedTabs
          tabs={TABS.map((t) => ({
            ...t,
            active: tab === t.id,
            onClick: () => setTab(t.id),
          }))}
        />
      </div>

      {!hasAnySchedule && myClasses.length > 0 && (
        <div className="card" style={{ fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
          لم تُضبط مواعيد حصص على صفوفك بعد. اطلب من الإدارة إضافة أيام وساعات عند إنشاء/تعديل الصف.
        </div>
      )}

      {tab === 'today' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="today" size={18} color="var(--gold)" />
            حصص اليوم · {today}
          </h2>
          {todaySlots.length === 0 && (
            <div className="card" style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
              لا حصص مجدولة لك اليوم.
            </div>
          )}
          {todaySlots.map((row) => (
            <SlotCard key={`${row.classId}-${row.start}-${row.end}`} row={row} />
          ))}
        </section>
      )}

      {tab === 'week' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SCHOOL_DAYS.map((day) => (
            <div key={day} className="card" style={{ gap: 10 }}>
              <div className="card-title" style={{ margin: 0, fontSize: 16 }}>
                {day}
                {day === today ? <span className="tag tag-accent" style={{ marginInlineStart: 8, fontSize: 11 }}>اليوم</span> : null}
              </div>
              {(week[day] || []).length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا حصص</div>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {(week[day] || []).map((row) => (
                  <div
                    key={`${day}-${row.classId}-${row.start}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                      padding: '10px 12px',
                      background: 'color-mix(in srgb, var(--color-neutral-100) 80%, transparent)',
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{row.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
                        {[row.subject, row.grade].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="ah-tabnum" dir="ltr" style={{ fontSize: 13 }}>{row.start}{row.end ? ` – ${row.end}` : ''}</span>
                      <Link to={`/teacher/classes/${row.classId}`} style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>
                        فتح
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
