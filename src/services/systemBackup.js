import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

export const WIPE_CONFIRM_PHRASE = 'مسح-كل-البيانات';

export async function exportSystemBackup() {
  const fn = httpsCallable(functions, 'exportSystemBackup', { timeout: 540000 });
  const res = await fn({});
  return res.data;
}

export async function importSystemBackup(payload) {
  const fn = httpsCallable(functions, 'importSystemBackup', { timeout: 540000 });
  const res = await fn(payload);
  return res.data;
}

export async function wipeSystemData(confirm) {
  const fn = httpsCallable(functions, 'wipeSystemData', { timeout: 540000 });
  const res = await fn({ confirm });
  return res.data;
}

export function downloadJsonFile(fileName, data) {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'backup.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
