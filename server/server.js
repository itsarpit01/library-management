import "dotenv/config"; // sabse upar, taaki baaki imports ko env mile
import express from "express";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET missing or too short (use at least 32 characters)");
  process.exit(1);
}

connectDB();

const app = express();

app.use(helmet());


app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  })
);

app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.send("Library API is running...");
});

app.use("/api", apiLimiter, routes);


app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));