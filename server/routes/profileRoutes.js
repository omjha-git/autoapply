const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const requireAuth = require("../middleware/authMiddleware");

const {
    getProfile,
    updateProfile
} = require("../controllers/profileController");

const {
    uploadResume
} = require("../controllers/resumeController");

const router = express.Router();

// Absolute uploads directory
const uploadDir = path.resolve(__dirname, "../uploads");

// Make sure the directory exists
fs.mkdirSync(uploadDir, {
    recursive: true
});

console.log("Resume upload directory:", uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);

        const filename =
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only PDF, DOCX, and TXT files are allowed."
            ),
            false
        );
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

// Profile
router.get("/", requireAuth, getProfile);

router.put(
    "/",
    requireAuth,
    updateProfile
);

// Resume
router.post(
    "/resume",
    requireAuth,
    upload.single("resume"),
    uploadResume
);

module.exports = router;