// Day labels / plan formatting — ported from web src/lib/planUtils.js.
// (Note: duplicated in features/chat/plans.ts, mirroring the web layout.)
import type { SoloPlan } from '../types/db';

export const PLAN_DAYS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
] as const;

export const PLAN_TIME_PRESETS = [
  'Morning',
  'Lunch',
  'Afternoon',
  'After class',
  'Evening',
  'Night',
] as const;

export function dayLabel(value: string): string {
  return PLAN_DAYS.find((d) => d.value === value)?.label ?? value;
}

export function describePlan(plan: Partial<SoloPlan> | null | undefined): string {
  if (!plan) return '';
  return [dayLabel(plan.day ?? ''), plan.time_label, plan.place, plan.activity]
    .filter(Boolean)
    .join(' · ');
}
