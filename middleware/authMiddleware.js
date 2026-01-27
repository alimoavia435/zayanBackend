import jwt from "jsonwebtoken";
import User from "../model/User.js";

export const protect = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ message: "Not authorized, token missing" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select("-password");

    next();
  } catch (err) {
    res.status(401).json({ message: "Not authorized" });
  }
};

export const admin = async (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ message: "Not authorized, please login first" });
  }

  // Check if user has admin role
  if (!req.user.roles || !req.user.roles.includes("admin")) {
    return res
      .status(403)
      .json({ message: "Access denied. Admin role required." });
  }

  next();
};

export const optionalProtect = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    next();
  } catch (err) {
    // If token is invalid, we still proceed but without req.user
    next();
  }
};
