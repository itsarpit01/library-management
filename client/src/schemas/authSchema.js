import { z } from "zod";

export const registerFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Max 50 characters"),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Add at least one capital letter")
    .regex(/[a-z]/, "Add at least one small letter")
    .regex(/[0-9]/, "Add at least one number")
    .regex(/[^A-Za-z0-9]/, "Add at least one special character"),
});