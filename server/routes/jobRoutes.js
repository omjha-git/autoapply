const express = require("express");

const router = express.Router();

const {
    searchJobs,
    getJobs
} = require("../controllers/jobController");

const requireAuth =
    require("../middleware/authMiddleware");

// =====================================
// PROTECTED JOB ROUTES
// =====================================

// Search jobs
router.get(
    "/search",
    requireAuth,
    searchJobs
);

// Get saved jobs
router.get(
    "/",
    requireAuth,
    getJobs
);

module.exports = router;