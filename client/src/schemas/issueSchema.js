import { z } from "zod";
import { dateInput, MAX_ISSUE_DAYS } from "../utils/format";

// "YYYY-MM-DD" strings seedha compare ho jaati hain
export const dueDateField = z
  .string()
  .min(1, "Select a due date")
  .refine(
    (v) => v >= dateInput(1) && v <= dateInput(MAX_ISSUE_DAYS),
    `Pick a date within the next ${MAX_ISSUE_DAYS} days`
  );

export const issueFormSchema = z.object({
  memberId: z.string().min(1, "Select a member"),
  bookId: z.string().min(1, "Select a book"),
  dueDate: dueDateField,
});

export const dueDateFormSchema = z.object({ dueDate: dueDateField });