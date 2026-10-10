const express = require("express");

const {
    createApplication,
    getApplications,
    updateApplication,
    generateCoverLetter
} = require("../controllers/applicationController");

const auth = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", auth, getApplications);

router.post("/", auth, createApplication);

router.patch("/:id", auth, updateApplication);

// Generate (or regenerate) AI cover letter for a saved application
router.post("/:id/cover-letter", auth, generateCoverLetter);

module.exports = router;