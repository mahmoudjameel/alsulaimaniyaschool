import { openWhatsAppChat, parseStoredPhone, toWhatsAppNumber } from './phone';

/** Resolve a wa.me-ready target from student doc and/or guardian subdoc. */
export function guardianWhatsAppTarget(student, guardian) {
  if (guardian?.phone) {
    const parsed = parseStoredPhone(guardian.phone);
    if (toWhatsAppNumber(parsed.dialCode, parsed.local)) return parsed;
  }
  if (!student) return null;
  const parsed = parseStoredPhone(student);
  if (toWhatsAppNumber(parsed.dialCode, parsed.local)) return parsed;
  return null;
}

export function openGuardianWhatsApp(student, message, guardian) {
  const target = guardianWhatsAppTarget(student, guardian);
  if (!target) return false;
  return openWhatsAppChat(target, message);
}
