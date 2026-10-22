import fs from "fs";

export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    // Multer file pehle hi save kar chuka hota hai, validation fail ho to hata do
    if (req.file) fs.unlink(req.file.path, () => {});

    return res.status(400).json({
      message: "Validation failed",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (source === "body") req.body = result.data;
  next();
};