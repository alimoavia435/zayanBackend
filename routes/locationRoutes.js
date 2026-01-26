import express from "express";
import { searchLocation } from "../controller/locationController.js";

const router = express.Router();

router.get("/search", searchLocation);

export default router;
