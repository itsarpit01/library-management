import { z } from "zod";

const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Invalid email address");

export const registerSchema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(2, "Name must be at least 2 characters").max(50),
  email: emailSchema,
  password: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
  role: z.enum(["librarian", "purchaser"]).default("purchaser"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});