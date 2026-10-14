import { z } from "zod";

export const makeRequestFormSchema = (maxQty) =>
  z.object({
    bookId: z.string().min(1, "Select a book"),
    quantity: z.coerce
      .number({ error: "Quantity must be a number" })
      .int("Quantity must be a whole number")
      .min(1, "At least 1")
      .max(maxQty || 1, `Library has only ${maxQty} copies`),
    reason: z
      .string()
      .trim()
      .min(5, "Reason must be at least 5 characters")
      .max(500, "Max 500 characters"),
  });

export const reviewSchema = z.object({
  reviewNote: z.string().trim().max(300, "Max 300 characters"),
});