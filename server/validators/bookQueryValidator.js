import { z } from "zod";

export const bookQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
  author: z.string().trim().max(100).optional(),
  available: z
    .enum(["true", "false"], { message: "available must be true or false" })
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  sort: z
    .string()
    .regex(/^-?(title|author|price|createdAt)$/, "Invalid sort field")
    .default("-createdAt"),
  page: z.coerce.number().int().min(1, "page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "limit must be at least 1")
    .max(50, "limit cannot exceed 50")
    .default(10),
});