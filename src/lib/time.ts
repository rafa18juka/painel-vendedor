import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

export function getNow() {
  return toZonedTime(new Date(), TIMEZONE);
}

export function formatDate(date: Date, fmt = 'yyyy-MM-dd') {
  return format(toZonedTime(date, TIMEZONE), fmt);
}

export function toZonedISO(date: Date) {
  const zoned = toZonedTime(date, TIMEZONE);
  return format(zoned, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export function parseDate(dateString: string) {
  return toZonedTime(parseISO(dateString), TIMEZONE);
}

export function getWeekKey(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return format(start, "yyyy-'W'II");
}

export function getWeekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start: format(start, 'dd/MM'), end: format(end, 'dd/MM') };
}

export function toUtc(date: Date) {
  return fromZonedTime(date, TIMEZONE);
}

export function getTimezone() {
  return TIMEZONE;
}
