/**
 * DEPRECATED: This directory is kept for backward compatibility.
 *
 * The canonical implementation now lives in `../services/ai/`.
 * This file simply re-exports it so any external reference to
 * `require("../ai/answerGenerator")` continues to work.
 */
module.exports = require("../services/ai/answerGenerator");