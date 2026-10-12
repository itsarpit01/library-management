import jwt from "jsonwebtoken";

// Token check: logged in hai ya nahi
export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role }
    next();
  } catch (error) {
    res.status(401).json({ message: "Token invalid or expired" });
  }
};

// Role check: sirf allowed roles ko jaane do
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};