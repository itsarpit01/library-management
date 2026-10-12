import { z } from "zod";

export const createPurchaseRequestSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  author: z.string().trim().min(1, "Author is required"),
  isbn: z
    .string()
    .trim()
    .transform((v) => v.replace(/-/g, ""))
    .refine((v) => /^(\d{10}|\d{13})$/.test(v), "Invalid ISBN")
    .optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").default(1),
  estimatedPrice: z.coerce.number().min(0, "Price cannot be negative").optional(),
  reason: z.string().trim().max(500, "Reason is too long").optional(),
});

export const reviewPurchaseRequestSchema = z
  .object({
    status: z.enum(["approved", "rejected"], {
      message: "Status must be approved or rejected",
    }),
    reviewNote: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.status !== "rejected" || (d.reviewNote && d.reviewNote.length > 0), {
    message: "Review note is required when rejecting",
    path: ["reviewNote"],
  });