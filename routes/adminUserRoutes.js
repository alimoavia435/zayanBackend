import express from "express";
import {
  getUsers,
  getUserDetails,
  suspendUser,
  banUser,
  reactivateUser,
  disableUserRole,
  enableUserRole,
} from "../controller/adminUserController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.get("/", protectAdmin, getUsers);
router.get("/:userId", protectAdmin, getUserDetails);
router.post("/suspend/:userId", protectAdmin, suspendUser);
router.post("/ban/:userId", protectAdmin, banUser);
router.post("/reactivate/:userId", protectAdmin, reactivateUser);
router.post("/disable-role/:userId", protectAdmin, disableUserRole);
router.post("/enable-role/:userId", protectAdmin, enableUserRole);

export default router;

