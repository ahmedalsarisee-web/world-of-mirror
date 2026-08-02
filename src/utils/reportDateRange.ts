import dayjs from 'dayjs';

export function filterRecordsByDateRange<T extends {createdAt: string}>(
  records: T[],
  startDateKey: string,
  endDateKey: string,
): T[] {
  const start = dayjs(startDateKey).startOf('day');
  const end = dayjs(endDateKey).endOf('day');

  return records.filter((record) => {
    const createdAt = dayjs(record.createdAt);
    return (
      (createdAt.isSame(start) || createdAt.isAfter(start)) &&
      (createdAt.isSame(end) || createdAt.isBefore(end))
    );
  });
}
