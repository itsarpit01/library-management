import { z } from "zod";

export const requestFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150, "Max 150 characters"),
  author: z.string().trim().min(1, "Author is required").max(100, "Max 100 characters"),
  isbn: z
    .string()
    .trim()
    .transform((v) => v.replace(/-/g, ""))
    .refine((v) => v === "" || /^(\d{10}|\d{13})$/.test(v), "ISBN must be 10 or 13 digits"),
  quantity: z.coerce
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "At least 1"),
  estimatedPrice: z
    .string()
    .trim()
    .refine((v) => v === "" || (!isNaN(Number(v)) && Number(v) >= 0), "Price must be 0 or more"),
  reason: z.string().trim().max(500, "Max 500 characters"),
});

export const reviewSchema = z.object({
  reviewNote: z.string().trim().max(300, "Max 300 characters"),
});