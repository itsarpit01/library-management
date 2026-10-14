import { z } from "zod";

export const createRequestSchema = z.object({
  bookId: z
    .string({ error: "Select a book" })
    .regex(/^[0-9a-fA-F]{24}$/, "Select a valid book"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "At least 1"),
  reason: z
    .string({ error: "Reason is required" })
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(500, "Max 500 characters"),
});

export const reviewRequestSchema = z.object({
  status: z.enum(["approved", "rejected"], {
    error: "Status must be approved or rejected",
  }),
  reviewNote: z.string().trim().max(300, "Max 300 characters").optional(),
});
export const updateRequestSchema = z.object({
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "At least 1"),
  reason: z
    .string({ error: "Reason is required" })
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(500, "Max 500 characters"),
});