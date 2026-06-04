import dayjs from 'dayjs';
import type {AttendanceRecord} from '@app/types/models';

function getRecordDateTokens(iso: string): string[] {
  const date = dayjs(iso);
  if (!date.isValid()) {
    return [];
  }

  return [
    date.format('YYYY-MM-DD'),
    date.format('DD/MM/YYYY'),
    date.format('DD-MM-YYYY'),
    date.format('DD MMM YYYY'),
    date.format('MMMM YYYY'),
    date.format('YYYY'),
    date.format('HH:mm'),
    date.format('hh:mm A'),
  ].map((value) => value.toLowerCase());
}

export function searchAttendanceRecords(
  records: AttendanceRecord[],
  searchQuery: string,
): AttendanceRecord[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return records;
  }

  return records.filter((record) => {
    const note = (record.note ?? '').toLowerCase();
    if (note.includes(query)) {
      return true;
    }

    return getRecordDateTokens(record.createdAt).some((token) => token.includes(query));
  });
}
