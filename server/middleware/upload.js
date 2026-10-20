import multer from "multer";
import path from "path";

// Storage config — decides WHERE and with WHAT NAME to save
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = file.fieldname === "avatar" ? "uploads/profiles" : "uploads/books";
    cb(null, folder);
  },
  filename(req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter — only images allowed
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype);

  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed"), false);
  }
};

// Export configured multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
});

export default upload;