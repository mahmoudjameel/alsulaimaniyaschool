import { WHATSAPP_DIAL_OPTIONS, isValidLocalMobile, normalizeLocalMobile, toE164Display } from '../lib/phone';

/**
 * Forced WhatsApp-ready phone: dial prefix (+970 / +972) + local 05XXXXXXXX.
 */
export default function PhoneWhatsAppField({
  dialCode,
  localPhone,
  onDialChange,
  onLocalChange,
  required = true,
  label = 'رقم واتساب ولي الأمر',
  error,
}) {
  const local = normalizeLocalMobile(localPhone);
  const valid = !local || isValidLocalMobile(local);
  const preview = valid && local ? toE164Display(dialCode, local) : '';

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
        <select
          className="input"
          value={dialCode}
          onChange={(e) => onDialChange(e.target.value)}
          required={required}
          aria-label="مقدمة واتساب"
          dir="ltr"
        >
          {WHATSAPP_DIAL_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </select>
        <input
          className="input"
          value={localPhone}
          onChange={(e) => onLocalChange(e.target.value)}
          placeholder="0592799888"
          dir="ltr"
          style={{ textAlign: 'left' }}
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          aria-invalid={local && !valid}
        />
      </div>
      <div style={{ fontSize: 11, color: valid ? 'var(--color-neutral-500)' : 'var(--color-accent-2-700)', marginTop: 6, lineHeight: 1.6 }}>
        {local && !valid
          ? 'أدخل رقماً جوّالاً صحيحاً مثل 0592799888 (يبدأ بـ 05 وطوله 10 أرقام).'
          : preview
            ? `سيُحفظ ويُستخدم على واتساب كـ ${preview}`
            : 'اختر مقدمة واتسابك (+970 أو +972) ثم اكتب الرقم المحلي كما في هاتفك.'}
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--color-accent-2-700)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
