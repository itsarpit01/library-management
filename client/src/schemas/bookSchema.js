import { z } from "zod";

export const bookFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150, "Max 150 characters"),
  author: z.string().trim().min(1, "Author is required").max(100, "Max 100 characters"),
  isbn: z
    .string()
    .trim()
    .transform((v) => v.replace(/-/g, ""))
    .refine((v) => /^(\d{10}|\d{13})$/.test(v), "ISBN must be 10 or 13 digits"),
  category: z.string().trim().max(50, "Max 50 characters").optional(),
  price: z.coerce
    .number({ error: "Price must be a number" })
    .nonnegative("Price cannot be negative"),
  totalCopies: z.coerce
    .number({ error: "Copies must be a number" })
    .int("Copies must be a whole number")
    .min(1, "At least 1 copy"),
});