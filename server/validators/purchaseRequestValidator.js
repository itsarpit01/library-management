import { z } from "zod";
import { dueDateSchema } from "../utils/dates.js";

const bookIdSchema = z
  .string({ error: "Select a book" })
  .regex(/^[0-9a-fA-F]{24}$/, "Select a valid book");

const quantitySchema = z
  .number({ error: "Quantity must be a number" })
  .int("Quantity must be a whole number")
  .min(1, "At least 1");

const reasonSchema = z
  .string({ error: "Reason is required" })
  .trim()
  .min(5, "Reason must be at least 5 characters")
  .max(500, "Max 500 characters");

const requestFields = {
  bookId: bookIdSchema,
  quantity: quantitySchema,
  neededUntil: dueDateSchema, // ab required, "YYYY-MM-DD"
  reason: reasonSchema,
};

export const createRequestSchema = z.object(requestFields);
export const updateRequestSchema = z.object(requestFields);

export const reviewRequestSchema = z
  .object({
    status: z.enum(["approved", "rejected", "counter_offered"], {
      error: "Status must be approved, rejected, or counter_offered",
    }),
    proposedDate: z.coerce.date().optional(), // range controller mein plan ke saath check hoti hai
    reviewNote: z.string().trim().max(300, "Max 300 characters").optional(),
  })
  .refine((d) => d.status !== "counter_offered" || d.proposedDate, {
    message: "Pick the date you can give the book until",
    path: ["proposedDate"],
  })
  .refine((d) => d.status !== "rejected" || (d.reviewNote && d.reviewNote.length > 0), {
    message: "Review note is required when rejecting",
    path: ["reviewNote"],
  });