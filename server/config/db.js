const mongoose = require("mongoose");

// Track connection state so the health-check endpoint can report
// the real status to the frontend instead of crashing on failure.
let isConnected = false;

/**
 * Attempt to connect to MongoDB with a limited number of retries.
 * If all retries fail the server still starts — API routes that need
 * the DB will fail individually rather than crashing the process.
 * This makes the app degrade gracefully when the database is
 * unreachable (e.g. wrong credentials, no network).
 */
const connectDB = async () => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose.connect(process.env.MONGO_URI);
            isConnected = true;
            console.log("MongoDB Connected");
            return;
        } catch (error) {
            console.error(
                `MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed:`,
                error.message
            );

            if (attempt < MAX_RETRIES) {
                await new Promise((resolve) =>
                    setTimeout(resolve, RETRY_DELAY_MS)
                );
            }
        }
    }

    // After all retries — log and continue. Routes that need the DB
    // will fail individually; the health endpoint will report unhealthy.
    isConnected = false;
    console.error(
        "MongoDB unreachable after retries. Server starting in " +
        "degraded mode — DB-dependent routes will return errors."
    );
};

/**
 * Returns the current Mongoose connection state.
 * True  = connected, False = disconnected/unavailable.
 */
const isDBConnected = () => isConnected;

module.exports = connectDB;
module.exports.isDBConnected = isDBConnected;