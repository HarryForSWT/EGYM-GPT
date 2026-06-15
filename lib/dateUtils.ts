/**
 * Helper map to parse date parts in a given timezone.
 */
function getPartsMap(d: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(d);

  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = parseInt(part.value, 10);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/**
 * Returns timezone offset in milliseconds for the given date in target timezone.
 * offset = local_time - utc_time.
 */
export function getTzOffsetMs(d: Date, timeZone: string = 'Europe/Berlin'): number {
  const tzParts = getPartsMap(d, timeZone);
  const tzUtc = Date.UTC(
    tzParts.year,
    tzParts.month - 1,
    tzParts.day,
    tzParts.hour,
    tzParts.minute,
    tzParts.second
  ) + d.getUTCMilliseconds();
  return tzUtc - d.getTime();
}

/**
 * Get the UTC Date bounds (start/end) for the German day corresponding to the given date.
 */
export function getGermanDateBounds(date: Date = new Date()): { start: Date; end: Date } {
  const tzParts = getPartsMap(date, 'Europe/Berlin');
  
  // Construct UTC estimates of midnight and end of day in local year-month-day
  const midnightUtc = new Date(Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, 0, 0, 0, 0));
  const offsetStart = getTzOffsetMs(midnightUtc, 'Europe/Berlin');
  const start = new Date(midnightUtc.getTime() - offsetStart);

  const endUtc = new Date(Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, 23, 59, 59, 999));
  const offsetEnd = getTzOffsetMs(endUtc, 'Europe/Berlin');
  const end = new Date(endUtc.getTime() - offsetEnd);

  return { start, end };
}

/**
 * Returns bounds for the Monday-to-Sunday week containing the given date in Germany,
 * and an array of 7 Date objects corresponding to midnight of each day of that week.
 */
export function getGermanWeekBounds(date: Date = new Date()): { start: Date; end: Date; days: Date[] } {
  const tzParts = getPartsMap(date, 'Europe/Berlin');
  // Construct a Date object representing German noon of that day to avoid DST boundary confusion when manipulating
  const noonUtc = new Date(Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, 12, 0, 0, 0));
  const offsetNoon = getTzOffsetMs(noonUtc, 'Europe/Berlin');
  const localNoon = new Date(noonUtc.getTime() - offsetNoon);

  // In Europe/Berlin, what day of the week is it?
  // Note: we want Monday to be the first day (index 0).
  // Standard getUTCDay() of localNoon will be the weekday (0=Sun, 1=Mon, ..., 6=Sat).
  // Since localNoon was adjusted to match Europe/Berlin time, its UTC day is exactly the German weekday!
  const utcDay = localNoon.getUTCDay(); 
  const germanWeekdayIndex = utcDay === 0 ? 6 : utcDay - 1; // Mon=0, ..., Sun=6

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const diffDays = i - germanWeekdayIndex;
    const targetDayNoon = new Date(localNoon.getTime() + diffDays * 24 * 60 * 60 * 1000);
    const bounds = getGermanDateBounds(targetDayNoon);
    days.push(bounds.start);
  }

  return {
    start: days[0], // Monday 00:00:00.000
    end: getGermanDateBounds(days[6]).end, // Sunday 23:59:59.999
    days
  };
}

/**
 * Formats a Date or UTC string as a local German YYYY-MM-DD date.
 */
export function getGermanDateString(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const tzParts = getPartsMap(d, 'Europe/Berlin');
  const year = tzParts.year;
  const month = String(tzParts.month).padStart(2, '0');
  const day = String(tzParts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
