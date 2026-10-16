import { z } from "zod";
import { dueDateSchema } from "../utils/dates.js";

const objectId = (label) =>
  z.string({ error: `${label} is required` }).regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label}`);

export const createBorrowRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("borrow"), bookId: objectId("bookId"), dueDate: dueDateSchema }),
  z.object({ type: z.literal("reissue"), issueId: objectId("issueId"), dueDate: dueDateSchema }),
]);

export const reviewBorrowRequestSchema = z
  .object({
    status: z.enum(["approved", "rejected"], { message: "Status must be approved or rejected" }),
    reviewNote: z.string().trim().max(300, "Max 300 characters").optional(),
  })
  .refine((d) => d.status !== "rejected" || (d.reviewNote && d.reviewNote.length > 0), {
    message: "Review note is required when rejecting",
    path: ["reviewNote"],
  });