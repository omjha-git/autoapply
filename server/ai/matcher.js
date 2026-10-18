/**
 * DEPRECATED: This directory is kept for backward compatibility.
 *
 * The canonical implementation now lives in ../services/ai/.
 * This file simply re-exports it so any external reference to
 * require("../ai/matcher") continues to work.
 *
 * The older inline copy that used job.skills has been replaced
 * with the newer resolver-based version from services/ai/.
 */
module.exports = require("../services/ai/matcher");
