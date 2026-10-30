import { z } from "zod";
import { makeDueDateField } from "./issueSchema";

export const makeRequestFormSchema = (maxQty, maxDays) =>
  z.object({
    bookId: z.string().min(1, "Select a book"),
    quantity: z.coerce
      .number({ error: "Quantity must be a number" })
      .int("Quantity must be a whole number")
      .min(1, "At least 1")
      .max(maxQty || 1, maxQty ? `Library has only ${maxQty} copies` : "Select a book first"),
    neededUntil: makeDueDateField(maxDays),
    reason: z
      .string()
      .trim()
      .min(10, "Reason must be at least 10 characters")
      .max(500, "Max 500 characters")
      // Must contain at least 2 real words (letters separated by a space)
      .refine(
        (val) => /[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/.test(val),
        "Reason must contain at least two meaningful words"
      )
      // No more than 20% special characters  (e.g. ^%%ER%^&%^%%%^ fails this)
      .refine(
        (val) => {
          const specialCount = (val.match(/[^a-zA-Z0-9\s]/g) || []).length;
          return specialCount / val.length <= 0.2;
        },
        "Reason contains too many special characters"
      )
      // No character repeated 4+ times in a row (e.g. "ssssss" fails)
      .refine(
        (val) => !/(.)\1{3,}/.test(val),
        "Reason looks like random keyboard input — please describe your need clearly"
      ),
  });

export const reviewSchema = z.object({
  reviewNote: z.string().trim().max(300, "Max 300 characters"),
});