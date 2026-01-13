import jwt from "jsonwebtoken";
import Admin from "../model/Admin.js";

// @desc    Protect admin routes - verify JWT token
export const protectAdmin = async (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Not authorized, token missing" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const admin = await Admin.findById(decoded.id).select("-password");

      if (!admin) {
        return res.status(401).json({ message: "Admin not found" });
      }

      if (!admin.isActive) {
        return res.status(403).json({ message: "Admin account is deactivated" });
      }

      req.admin = {
        id: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      };

      next();
    } catch (err) {
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Check if admin has required role
export const checkAdminRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: "Not authorized, please login first" });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
      });
    }

    next();
  };
};

// @desc    Check if admin has required permission
export const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: "Not authorized, please login first" });
    }

    // SuperAdmin has all permissions
    if (req.admin.role === "superAdmin") {
      return next();
    }

    // Check if admin has the required permission
    if (!req.admin.permissions || !req.admin.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        message: `Access denied. Required permission: ${requiredPermission}`,
      });
    }

    next();
  };
};

// @desc    Check if admin has any of the required permissions
export const checkAnyPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: "Not authorized, please login first" });
    }

    // SuperAdmin has all permissions
    if (req.admin.role === "superAdmin") {
      return next();
    }

    // Check if admin has any of the required permissions
    const hasPermission = requiredPermissions.some((permission) =>
      req.admin.permissions?.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        message: `Access denied. Required permission: ${requiredPermissions.join(" or ")}`,
      });
    }

    next();
  };
};

