import type { DateRange } from "../shared/contracts.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function shiftDate(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(days)) return "";
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return "";
  const parsed = new Date(timestamp);
  if (parsed.toISOString().slice(0, 10) !== date) return "";
  return new Date(timestamp + days * DAY_MS).toISOString().slice(0, 10);
}

export function inclusiveEndDate(period: DateRange): string {
  return shiftDate(period.toExclusive, -1);
}

export function periodWithInclusiveEnd(
  period: DateRange,
  endInclusive: string,
): DateRange {
  return { ...period, toExclusive: shiftDate(endInclusive, 1) };
}

export function periodWithStart(period: DateRange, start: string): DateRange {
  if (!start) return { ...period, from: "" };
  const maxEnd = shiftDate(start, 399);
  const currentEnd = inclusiveEndDate(period);
  let endInclusive = currentEnd && currentEnd >= start ? currentEnd : start;
  if (maxEnd && endInclusive > maxEnd) endInclusive = maxEnd;
  return {
    from: start,
    toExclusive: shiftDate(endInclusive, 1),
    timeZone: period.timeZone,
  };
}

export function isValidPeriod(period: DateRange): boolean {
  const fromTime = Date.parse(`${period.from}T00:00:00.000Z`);
  const toTime = Date.parse(`${period.toExclusive}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(period.from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(period.toExclusive) &&
    Number.isFinite(fromTime) &&
    Number.isFinite(toTime) &&
    new Date(fromTime).toISOString().slice(0, 10) === period.from &&
    new Date(toTime).toISOString().slice(0, 10) === period.toExclusive &&
    fromTime < toTime &&
    (toTime - fromTime) / DAY_MS <= 400 &&
    period.timeZone === "America/Sao_Paulo"
  );
}
