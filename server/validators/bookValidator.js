import { z } from "zod";

const isbnSchema = z
  .string({ error: "ISBN is required" })
  .trim()
  .transform((v) => v.replace(/-/g, ""))
  .refine((v) => /^(\d{10}|\d{13})$/.test(v), "ISBN must be 10 or 13 digits");

const bookFields = {
  title: z.string({ error: "Title is required" }).trim().min(1, "Title is required").max(150),
  author: z.string({ error: "Author is required" }).trim().min(1, "Author is required").max(100),
  isbn: isbnSchema,
  category: z.string().trim().max(50),
  price: z.coerce.number({ error: "Price must be a number" }).nonnegative("Price cannot be negative"),
  totalCopies: z.coerce
    .number({ error: "Total copies must be a number" })
    .int("Total copies must be a whole number")
    .min(1, "At least 1 copy is required"),
};

export const createBookSchema = z.object({
  ...bookFields,
  category: bookFields.category.optional(),
  totalCopies: bookFields.totalCopies.default(1),
});

export const updateBookSchema = z
  .object(bookFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid book id"),
});