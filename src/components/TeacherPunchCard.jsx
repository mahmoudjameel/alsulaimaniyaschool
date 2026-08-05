import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useSchoolSite } from '../hooks/useSchoolSite';
import { useStaffPunch } from '../hooks/useTeacherPunch';
import { punchCardCopy } from '../lib/punchCopy';

/** Punch widget for teacher / accountant / reception dashboards. */
export default function TeacherPunchCard({ compact = false, detailsTo = '/teacher/punch' }) {
  const { site } = useSchoolSite();
  const punch = useStaffPunch();
  const copy = punchCardCopy(site);

  return (
    <div
      className="card"
      style={{
        borderColor: punch.checkedOut
          ? 'var(--color-accent-300)'
          : punch.checkedIn
            ? 'var(--gold)'
            : 'var(--line)',
        background: punch.checkedIn && !punch.checkedOut
          ? 'color-mix(in srgb, var(--gold) 8%, transparent)'
          : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--color-neutral-100)',
            color: 'var(--gold)',
            flexShrink: 0,
          }}
        >
          <Icon name="fingerprint" size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="card-kicker" style={{ marginBottom: 2 }}>{copy.kicker}</div>
          <div className="card-title" style={{ fontSize: 17, margin: 0 }}>
            {copy.title}
          </div>
          {!compact && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.65 }}>
              {copy.hint}
            </p>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--color-neutral-500)' }}>{copy.timeIn}: </span>
              <strong className="ah-tabnum">{punch.checkInTime}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-neutral-500)' }}>{copy.timeOut}: </span>
              <strong className="ah-tabnum">{punch.checkOutTime}</strong>
            </div>
            <span className={`tag tag-${punch.checkedOut ? 'accent' : punch.checkedIn ? 'outline' : 'neutral'}`}>
              {punch.status}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: 13 }}
            disabled={punch.busy || punch.loading || punch.checkedIn || !site.punchEnabled}
            onClick={punch.checkIn}
          >
            <Icon name="login" size={15} /> {punch.busy && !punch.checkedIn ? 'جارٍ التسجيل…' : copy.btnIn}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
            disabled={punch.busy || punch.loading || !punch.checkedIn || punch.checkedOut || !site.punchEnabled}
            onClick={punch.checkOut}
          >
            <Icon name="logout" size={15} /> {punch.busy && punch.checkedIn ? 'جارٍ التسجيل…' : copy.btnOut}
          </button>
          {compact && detailsTo && (
            <Link to={detailsTo} className="btn btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
              {copy.details}
            </Link>
          )}
        </div>
      </div>
      {(punch.error || punch.message) && (
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            color: punch.error ? 'var(--color-accent-2-700)' : 'var(--color-accent-800)',
            lineHeight: 1.55,
          }}
        >
          {punch.error || punch.message}
        </div>
      )}
    </div>
  );
}
