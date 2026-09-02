import Icon from './Icon';

/** Clickable teacher rows for subject linking — avoids hidden .radio checkboxes. */
export default function SubjectTeacherPicker({ teachers, selectedIds, onChange }) {
  const selected = new Set(selectedIds || []);

  const toggle = (id) => {
    if (selected.has(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...(selectedIds || []), id]);
  };

  if (!teachers?.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
        لا معلّمين في الدليل بعد.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflow: 'auto' }}>
      {teachers.map((t) => {
        const on = selected.has(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              border: `2px solid ${on ? 'var(--color-accent-600, var(--gold))' : 'var(--line)'}`,
              borderRadius: 10,
              background: on ? 'var(--color-accent-100)' : 'var(--color-bg, #fff)',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'right',
              font: 'inherit',
              color: 'inherit',
            }}
          >
            <Icon
              name={on ? 'check_box' : 'check_box_outline_blank'}
              size={20}
              color={on ? 'var(--gold)' : 'var(--color-neutral-400)'}
            />
            <span style={{ flex: 1 }}>
              <strong>{t.name}</strong>
              {t.subject && t.subject !== '—' ? (
                <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}> · {t.subject}</span>
              ) : null}
              {!t.login && (
                <span style={{ fontSize: 11, color: 'var(--color-accent-2-700)' }}> (بدون حساب)</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
