import { z } from "zod";

export const MAX_ISSUE_DAYS = 15;
export const MAX_REISSUES = 2;

// "2026-10-30" -> us din ka 23:59:59 (due din par book overdue nahi maani jati)
export const toDueDate = (s) => new Date(`${s}T23:59:59`);

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const maxDue = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  d.setDate(d.getDate() + MAX_ISSUE_DAYS);
  return d;
};

// Kal se lekar aaj+15 din tak. Server par bhi check, sirf frontend par nahi.
export const dueDateSchema = z
  .string({ error: "Due date is required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .transform(toDueDate)
  .refine((d) => !Number.isNaN(d.getTime()), "Use a valid date")
  .refine(
    (d) => d > endOfToday() && d <= maxDue(),
    `Due date must be within the next ${MAX_ISSUE_DAYS} days`
  );