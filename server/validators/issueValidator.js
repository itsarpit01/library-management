import { z } from "zod";
import { dueDateSchema } from "../utils/dates.js";

const objectId = (label) =>
  z.string({ error: `${label} is required` }).regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label}`);

export const issueBookSchema = z.object({
  bookId: objectId("bookId"),
  memberId: objectId("memberId"),
  dueDate: dueDateSchema,
});

export const reissueSchema = z.object({ dueDate: dueDateSchema });

export const issueIdParamSchema = z.object({
  id: objectId("issue id"),
});