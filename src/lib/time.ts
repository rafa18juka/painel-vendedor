import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

export function getNow() {
  return utcToZonedTime(new Date(), TIMEZONE);
}

export function formatDate(date: Date, fmt = 'yyyy-MM-dd') {
  return format(utcToZonedTime(date, TIMEZONE), fmt);
}

export function toZonedISO(date: Date) {
  const zoned = utcToZonedTime(date, TIMEZONE);
  return format(zoned, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export function parseDate(dateString: string) {
  return utcToZonedTime(parseISO(dateString), TIMEZONE);
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
  return zonedTimeToUtc(date, TIMEZONE);
}

export function getTimezone() {
  return TIMEZONE;
}
