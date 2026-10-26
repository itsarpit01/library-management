import { z } from "zod";

export const MAX_REISSUES = 2;
export const ABS_MAX_DAYS = 60;

// "2026-10-30" -> us din ka 23:59:59 (due din par book overdue nahi maani jati)
export const toDueDate = (s) => new Date(`${s}T23:59:59`);

export const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

// Aaj + days ka aakhri second
export const maxDueFor = (days) => {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  d.setDate(d.getDate() + days);
  return d;
};

// Format aur "kal ya uske baad". Plan ka dynamic cap issueService.assertDueWithinTier handle karta hai.
export const dueDateSchema = z
  .string({ error: "Due date is required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .transform(toDueDate)
  .refine((d) => !Number.isNaN(d.getTime()), "Use a valid date")
  .refine((d) => d > endOfToday(), "Pick a date from tomorrow onwards");