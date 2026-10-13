import { z } from "zod";

export const issueFormSchema = z.object({
  memberId: z.string().min(1, "Select a member"),
  bookId: z.string().min(1, "Select a book"),
  days: z.coerce
    .number({ error: "Days must be a number" })
    .int("Days must be a whole number")
    .min(1, "Minimum 1 day")
    .max(60, "Maximum 60 days"),
});