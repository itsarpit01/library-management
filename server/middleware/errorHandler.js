export const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || err.status || 500;
  let message = err.message || "Server error";
  let errors;

  // Invalid ObjectId (e.g. /books/abc)
  if (err.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  // Mongoose schema validation
  if (err.name === "ValidationError") {
    status = 400;
    message = "Validation failed";
    errors = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
    );
  }

  // Duplicate key (e.g. ISBN, email)
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `${field} already exists`;
  }

  // JWT
  if (err.name === "JsonWebTokenError") {
    status = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    status = 401;
    message = "Token expired";
  }

  if (status === 500) console.error(err);

  res.status(status).json({
    message: status === 500 && process.env.NODE_ENV === "production"
      ? "Server error"
      : message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV !== "production" && status === 500 && { stack: err.stack }),
  });
};