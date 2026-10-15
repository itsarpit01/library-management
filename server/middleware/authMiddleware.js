import jwt from "jsonwebtoken";

// Token check: pehle cookie, phir Postman ke liye Bearer header
export const protect = (req, res, next) => {
  const header = req.headers.authorization;
  const token =
    req.cookies?.token ||
    (header?.startsWith("Bearer ") ? header.split(" ")[1] : null);

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role }
    next();
  } catch {
    res.status(401).json({ message: "Token invalid or expired" });
  }
};

// Role check
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};