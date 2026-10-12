import { z } from "zod";

const objectId = (label) =>
  z.string({ error: `${label} is required` }).regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label}`);

export const issueBookSchema = z.object({
  bookId: objectId("bookId"),
  memberId: objectId("memberId"),
  days: z
    .number({ error: "Days must be a number" })
    .int("Days must be a whole number")
    .min(1, "Minimum 1 day")
    .max(60, "Maximum 60 days")
    .default(14),
});

export const issueIdParamSchema = z.object({
  id: objectId("issue id"),
});