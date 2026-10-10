require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { clerkMiddleware } = require("@clerk/express");

const connectDB = require("./config/db");

const profileRoutes = require("./routes/profileRoutes");
const jobRoutes = require("./routes/jobRoutes");
const applicationRoutes = require("./routes/applicationRoutes");


connectDB();

const app = express();

app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true
    })
);

app.use(express.json());

app.use(clerkMiddleware());

app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "AutoApply API is running 🚀"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        service: "AutoApply API",
        status: "healthy"
    });
});

app.use(
    "/api/profile",
    profileRoutes
);

app.use(
    "/api/jobs",
    jobRoutes
);

app.use(
    "/api/applications",
    applicationRoutes
);

app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `AutoApply server running on http://localhost:${PORT}`
    );
});