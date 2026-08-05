import TeacherPunchCard from './TeacherPunchCard';
import BackButton from './BackButton';
import { useSchoolSite } from '../hooks/useSchoolSite';
import { useStaffPunch } from '../hooks/useTeacherPunch';
import { punchPageCopy } from '../lib/punchCopy';

/**
 * Shared punch page for teacher / accountant / reception portals.
 */
export default function StaffPunchPage({
  homeTo = '/teacher',
  detailsTo,
  roleKicker = 'الهيئة الإدارية',
}) {
  const { site } = useSchoolSite();
  const punch = useStaffPunch();
  const copy = punchPageCopy(roleKicker);
  const cardDetailsTo = detailsTo || `${homeTo.replace(/\/$/, '')}/punch`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
      <BackButton to={homeTo} label="عودة للوحة" />
      <div>
        <div className="card-kicker">{copy.roleKicker}</div>
        <h2 style={{ margin: '4px 0 8px', fontSize: 24 }}>{copy.title}</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-600)', lineHeight: 1.75 }}>
          {copy.lead}
        </p>
      </div>

      <TeacherPunchCard detailsTo={cardDetailsTo} />

      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>{copy.siteTitle}</div>
        <div style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--color-neutral-700)' }}>
          <div style={{ fontWeight: 600 }}>{site.nameAr}</div>
          <div>{site.locationLabelAr}</div>
          <div style={{ marginTop: 8 }}>{copy.radiusLabel(site.radiusMeters)}</div>
          <div className="ah-tabnum" dir="ltr" style={{ marginTop: 4, fontSize: 12, color: 'var(--color-neutral-500)' }}>
            {Number(site.latitude).toFixed(5)}, {Number(site.longitude).toFixed(5)}
          </div>
          {site.workdayStart && (
            <div style={{ marginTop: 8 }}>
              {copy.hoursLabel(site.workdayStart, site.workdayEnd)}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ fontSize: 13, color: 'var(--color-neutral-700)', lineHeight: 1.75 }}>
        <div className="card-title" style={{ marginBottom: 6, fontSize: 15 }}>{copy.dayLogTitle(punch.dateKey)}</div>
        <div>الحالة الحالية: <strong>{punch.status}</strong></div>
        <div style={{ marginTop: 6, color: 'var(--color-neutral-500)' }}>{copy.gpsNote}</div>
      </div>
    </div>
  );
}
