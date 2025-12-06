import express from "express";
import multer from "multer";
import { uploadToR2 } from "../controller/uploadController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const url = await uploadToR2(req.file);
    res.json({ success: true, url });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

export default router;
