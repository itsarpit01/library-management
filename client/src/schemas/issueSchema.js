import { z } from "zod";
import { dateInput } from "../utils/format";

// Default fallback cap jab tak dynamic tier na pass ho
const ABS_MAX_DAYS = 60;

// maxDays plan se aata hai (Free: 14, Premium: 30, Ultimate: Infinity / undefined)
export const makeDueDateField = (maxDays = ABS_MAX_DAYS) =>
  z
    .string()
    .min(1, "Select a due date")
    .refine(
      (v) => {
        if (!v || v < dateInput(1)) return false; // Kal se pehle ki date invalid
        if (!maxDays || maxDays === Infinity) return true; // Ultimate ke liye no max clamp (All upcoming dates)
        return v <= dateInput(maxDays);
      },
      maxDays && maxDays !== Infinity
        ? `Pick a date within the next ${maxDays} days`
        : "Pick a date from tomorrow onwards"
    );

export const makeIssueFormSchema = (maxDays = ABS_MAX_DAYS) =>
  z.object({
    memberId: z.string().min(1, "Select a member"),
    bookId: z.string().min(1, "Select a book"),
    dueDate: makeDueDateField(maxDays),
  });

export const makeDueDateFormSchema = (maxDays = ABS_MAX_DAYS) =>
  z.object({ dueDate: makeDueDateField(maxDays) });

// Backward compatibility ke liye default exports
export const dueDateField = makeDueDateField();
export const issueFormSchema = makeIssueFormSchema();
export const dueDateFormSchema = makeDueDateFormSchema();