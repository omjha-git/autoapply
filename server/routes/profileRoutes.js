const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const requireAuth = require("../middleware/authMiddleware");

const {
    getProfile,
    getDashboardStats,
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

router.get(
    "/dashboard-stats",
    requireAuth,
    getDashboardStats
);

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

// Multer error handler — catches file-size limit errors (LIMIT_FILE_SIZE),
// invalid file types from the fileFilter, and too-many-files errors.
// Without this, multer throws its own error object that bypasses the
// controller try/catch and produces an unhelpful HTML 500 page.
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File too large. Maximum size is 10 MB."
            });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
                success: false,
                message: "Too many files."
            });
        }
        if (error.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                success: false,
                message: "Unexpected file field."
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    if (
        error.message &&
        error.message.includes("Only PDF")
    ) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    next(error);
});

module.exports = router;