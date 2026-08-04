/** Palestinian mobile numbers for WhatsApp (personal wa.me — no Business API). */

export const WHATSAPP_DIAL_OPTIONS = [
  { code: '970', label: '+970', hint: 'فلسطين (شائع في غزّة والضفة)' },
  { code: '972', label: '+972', hint: 'مقدمة بديلة حسب تسجيل واتسابك' },
];

/** Digits only from user input. */
export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Normalize local mobile: accept 0592799888 or 592799888 → 0592799888
 * Must be 10 digits starting with 05, or 9 digits starting with 5.
 */
export function normalizeLocalMobile(raw) {
  let d = digitsOnly(raw);
  if (d.startsWith('970') && d.length >= 12) d = d.slice(3);
  if (d.startsWith('972') && d.length >= 12) d = d.slice(3);
  if (d.length === 9 && d.startsWith('5')) d = `0${d}`;
  return d;
}

/** Stable key shared by +970 / +972 for the same handset: 592799888 */
export function phoneKeyFromLocal(localRaw) {
  const local = normalizeLocalMobile(localRaw);
  if (!/^05\d{8}$/.test(local)) return null;
  return local.slice(1);
}

export function isValidLocalMobile(raw) {
  const d = normalizeLocalMobile(raw);
  return /^05\d{8}$/.test(d);
}

/** E.164 without plus: 970592799888 */
export function toWhatsAppNumber(dialCode, localRaw) {
  const code = String(dialCode || '970').replace(/\D/g, '');
  const local = normalizeLocalMobile(localRaw);
  if (!isValidLocalMobile(local)) return null;
  return `${code}${local.slice(1)}`; // drop leading 0
}

export function toE164Display(dialCode, localRaw) {
  const n = toWhatsAppNumber(dialCode, localRaw);
  return n ? `+${n}` : '';
}

export function formatPhoneDisplay(dialCode, localRaw) {
  const local = normalizeLocalMobile(localRaw);
  if (!isValidLocalMobile(local)) return localRaw || '—';
  const pretty = `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return `${dialCode === '972' ? '+972' : '+970'} ${pretty}`;
}

/**
 * Parse stored phone fields into dial + local.
 * Accepts: +970592799888, 970592799888, 0592799888, guardianPhoneE164, etc.
 */
export function parseStoredPhone(studentOrPhone, dialFallback = '970') {
  if (studentOrPhone && typeof studentOrPhone === 'object') {
    if (studentOrPhone.guardianPhoneDial && studentOrPhone.guardianPhoneLocal) {
      return {
        dialCode: String(studentOrPhone.guardianPhoneDial).replace(/\D/g, '') || dialFallback,
        local: normalizeLocalMobile(studentOrPhone.guardianPhoneLocal),
      };
    }
    if (studentOrPhone.dialCode && studentOrPhone.local) {
      return {
        dialCode: String(studentOrPhone.dialCode).replace(/\D/g, '') || dialFallback,
        local: normalizeLocalMobile(studentOrPhone.local),
      };
    }
    const raw = studentOrPhone.guardianPhoneE164 || studentOrPhone.guardianPhone || studentOrPhone.phone || '';
    return parseStoredPhone(raw, studentOrPhone.guardianPhoneDial || studentOrPhone.dialCode || dialFallback);
  }

  const raw = String(studentOrPhone || '');
  const d = digitsOnly(raw);
  if (d.startsWith('970') && d.length >= 12) {
    return { dialCode: '970', local: normalizeLocalMobile(d.slice(3)) };
  }
  if (d.startsWith('972') && d.length >= 12) {
    return { dialCode: '972', local: normalizeLocalMobile(d.slice(3)) };
  }
  return { dialCode: dialFallback, local: normalizeLocalMobile(d) };
}

export function buildWhatsAppUrl(dialCodeOrE164, localOrMessage, maybeMessage) {
  let waNumber;
  let text;
  if (maybeMessage !== undefined || (localOrMessage && String(localOrMessage).startsWith('05'))) {
    waNumber = toWhatsAppNumber(dialCodeOrE164, localOrMessage);
    text = maybeMessage || '';
  } else if (typeof dialCodeOrE164 === 'object') {
    const parsed = parseStoredPhone(dialCodeOrE164);
    waNumber = toWhatsAppNumber(parsed.dialCode, parsed.local);
    text = localOrMessage || '';
  } else {
    // dialCodeOrE164 is already wa number digits or +E164
    waNumber = digitsOnly(dialCodeOrE164);
    text = localOrMessage || '';
  }
  if (!waNumber) return null;
  const url = new URL(`https://wa.me/${waNumber}`);
  if (text) url.searchParams.set('text', text);
  return url.toString();
}

export function openWhatsAppChat(target, message) {
  const url = buildWhatsAppUrl(target, message);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export const FEE_REMINDER_TEMPLATE = (schoolName, studentName, amountLabel) =>
  `السلام عليكم،\nتذكير من ${schoolName} بخصوص الرسوم المستحقة للطالب/ة ${studentName}${amountLabel ? ` بمبلغ ${amountLabel}` : ''}.\nيرجى التواصل مع المحاسبة أو رفع إيصال التحويل عبر بوابة ولي الأمر.\nشكراً لتعاونكم.`;

export const ABSENCE_REMINDER_TEMPLATE = (schoolName, studentName, dateLabel) =>
  `السلام عليكم،\nنود إبلاغكم بغياب الطالب/ة ${studentName}${dateLabel ? ` بتاريخ ${dateLabel}` : ''} عن الدوام في ${schoolName}.\nيمكنكم تقديم تبرير الغياب من بوابة ولي الأمر.\nمع الاحترام.`;

export const GENERAL_MESSAGE_TEMPLATE = (schoolName, guardianName) =>
  `السلام عليكم${guardianName ? ` أستاذ/ة ${guardianName}` : ''}،\nرسالة من ${schoolName}.`;
