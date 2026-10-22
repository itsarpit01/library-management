import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import { verifyMailer } from "./utils/mailer.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET missing or too short (use at least 32 characters)");
  process.exit(1);
}

connectDB();
verifyMailer();

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })); // <- yahi badla

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Library API is running...");
});

app.use("/api", apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));