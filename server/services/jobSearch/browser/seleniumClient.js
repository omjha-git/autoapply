/**
 * browser/seleniumClient.js
 *
 * Lightweight Selenium WebDriver wrapper.
 *
 * selenium-webdriver is an OPTIONAL dependency. If it is not installed
 * (e.g. in CI or production without Chrome), `launchBrowser()` resolves
 * `null` so that callers (like the Wellfound adapter) can gracefully
 * fall back to the search-link strategy.
 *
 * When selenium-webdriver IS available, this module returns a headless
 * Chrome driver with sensible defaults for server-side rendering of
 * JS-heavy pages.
 *
 * Install (optional):
 *   npm install selenium-webdriver chromedriver
 *
 * Usage:
 *   const { launchBrowser, closeBrowser } = require("./browser/seleniumClient");
 *   const browser = await launchBrowser();
 *   if (!browser) return [];
 *   try {
 *       await browser.get("https://example.com");
 *       const html = await browser.getPageSource();
 *   } finally {
 *       await closeBrowser(browser);
 *   }
 */

const SELENIUM_ENABLED =
    process.env.SELENIUM_ENABLED !== "false";

/**
 * Maximum concurrent browser launches (global semaphore).
 * Prevents resource exhaustion when multiple Selenium-based adapters
 * (e.g. Wellfound) fetch pages in parallel.
 * Configurable via SELENIUM_MAX_CONCURRENT (default 3).
 */
const SELENIUM_MAX_CONCURRENT =
    parseInt(process.env.SELENIUM_MAX_CONCURRENT, 10) || 3;

let _activeBrowsers = 0;
let _queuedLaunches = [];

/**
 * Acquire a concurrency permit before launching a browser.
 * If the limit is reached, the promise resolves only when a
 * browser is closed (releasing a permit).
 */
const acquirePermit = () => {
    return new Promise((resolve) => {
        if (_activeBrowsers < SELENIUM_MAX_CONCURRENT) {
            _activeBrowsers++;
            resolve();
        } else {
            _queuedLaunches.push(resolve);
        }
    });
};

/**
 * Release a concurrency permit, allowing a queued launch to proceed.
 */
const releasePermit = () => {
    _activeBrowsers = Math.max(0, _activeBrowsers - 1);
    if (_queuedLaunches.length > 0) {
        const next = _queuedLaunches.shift();
        _activeBrowsers++;
        next();
    }
};

let _driver;

/**
 * Launch a headless Chrome browser via selenium-webdriver.
 *
 * @returns {Promise<object|null>} WebDriver instance, or null if
 *   selenium-webdriver is not installed or SELENIUM_ENABLED is "false".
 */
const launchBrowser = async () => {
    if (!SELENIUM_ENABLED) {
        console.warn(
            "[seleniumClient] SELENIUM_ENABLED=false — " +
            "JS-rendered sources will use search-link fallback."
        );
        return null;
    }

    await acquirePermit();

    try {
        const { Builder } = require("selenium-webdriver");
        const chrome = require("selenium-webdriver/chrome");

        _driver = await new Builder()
            .forBrowser("chrome")
            .setChromeOptions(
                new chrome.Options()
                    .headless()
                    .addArguments(
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-blink-features=AutomationControlled",
                        "--user-agent=AutoApplyJobSearch/1.0"
                    )
            )
            .build();

        // Set explicit page-load and script timeouts so no single
        // page or script can hang indefinitely.
        try {
            await _driver.manage().setTimeouts({
                pageLoad: parseInt(
                    process.env.SELENIUM_PAGE_LOAD_TIMEOUT_MS,
                    10
                ) || 15000,
                script: parseInt(
                    process.env.SELENIUM_SCRIPT_TIMEOUT_MS,
                    10
                ) || 10000
            });
        } catch (timeoutError) {
            // Not all drivers support setTimeouts; continue anyway.
            console.warn(
                "[seleniumClient] Could not set timeouts:",
                timeoutError.message
            );
        }

        return _driver;
    } catch (error) {
        releasePermit();
        console.warn(
            "[seleniumClient] selenium-webdriver not available — " +
            "falling back to search-link strategy: " +
            error.message
        );
        return null;
    }
};

/**
 * Wait for a JS-rendered page to reach "network idle" by polling
 * `document.readyState` and waiting for a configurable delay after
 * the readyState becomes "complete".
 *
 * @param {object} browser  WebDriver instance
 * @param {number} timeoutMs  Maximum wait time
 * @param {number} settleMs  Time to wait after readyState = "complete"
 */
const waitForNetworkIdle = async (
    browser,
    timeoutMs = 10000,
    settleMs = 1500
) => {
    if (!browser) return false;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const state = await browser.executeScript(
            "return document.readyState"
        );
        if (state === "complete") {
            await new Promise((r) => setTimeout(r, settleMs));
            return true;
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    return false;
};

/**
 * Gracefully close the browser. Safe to call with null/undefined.
 *
 * @param {object|null} browser
 */
const closeBrowser = async (browser) => {
    if (!browser) {
        releasePermit();
        return;
    }
    try {
        await browser.quit();
    } catch (error) {
        console.warn(
            "[seleniumClient] Error closing browser:",
            error.message
        );
    }
    if (_driver === browser) {
        _driver = null;
    }
    releasePermit();
};

module.exports = {
    launchBrowser,
    closeBrowser,
    waitForNetworkIdle,
    SELENIUM_ENABLED,
    SELENIUM_MAX_CONCURRENT
};
