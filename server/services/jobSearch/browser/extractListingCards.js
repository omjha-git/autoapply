/**
 * browser/extractListingCards.js
 *
 * Shared Selenium WebDriver helper for extracting individual job listing
 * cards from a rendered page.
 *
 * This helper is generic: callers provide CSS selectors for the card
 * container, title, link, company, and location elements. It is used by
 * any adapter that needs to parse JavaScript-rendered listing pages
 * (e.g. Wellfound).
 *
 * Design notes:
 *   - If the card element IS the anchor (common in link-based card
 *     designs where the entire card is wrapped in a single <a>), the
 *     helper automatically uses the card element itself as the link.
 *   - A `defaults` object allows passing page-level values (e.g. the
 *     company name on a per-company Wellfound page) so that cards
 *     don't need to contain every field.
 *   - Per-card errors are caught and the card is skipped — a single
 *     malformed card never fails the entire page.
 *   - Only http/https URLs are accepted; relative URLs are resolved
 *     against the current page URL.
 *   - `selenium-webdriver` is required lazily inside the function so
 *     that this module can be imported even when the optional
 *     dependency is not installed (matching seleniumClient.js behavior).
 *
 * Usage:
 *   const { extractListingCards } = require("./extractListingCards");
 *   const cards = await extractListingCards(driver, selectors, 12000);
 *
 * @param {object} driver       Selenium WebDriver instance
 * @param {object} selectors    { card, title, link, company?, location? }
 * @param {number} timeoutMs    Max time to wait for cards to appear
 * @param {object} defaults     Optional default values (e.g. { company: "acme" })
 * @returns {Promise<Array<{title, company, location, url}>>}
 */

async function extractListingCards(driver, selectors, timeoutMs = 12000, defaults = {}) {
    const { By, until } = require("selenium-webdriver");

    // Wait until at least one card element is present in the DOM.
    await driver.wait(
        until.elementLocated(By.css(selectors.card)),
        timeoutMs
    );

    const cards = await driver.findElements(By.css(selectors.card));
    const results = [];

    for (const card of cards) {
        try {
            const titleElements = await card.findElements(
                By.css(selectors.title)
            );

            const linkElements = await card.findElements(
                By.css(selectors.link)
            );

            // When the card element itself is an anchor tag (common in
            // link-based card designs), use the card as the link source.
            if (linkElements.length === 0) {
                const tagName = (await card.getTagName()).toLowerCase();
                if (tagName === "a") {
                    linkElements.push(card);
                }
            }

            // When no title or link element is found, skip this card.
            if (!titleElements.length || !linkElements.length) {
                continue;
            }

            const title = (await titleElements[0].getText()).trim();
            const href = await linkElements[0].getAttribute("href");

            const companyElements = await card.findElements(
                By.css(selectors.company || "body")
            );

            const locationElements = await card.findElements(
                By.css(selectors.location || "body")
            );

            let company = companyElements.length
                ? (await companyElements[0].getText()).trim()
                : "";
            if (!company && defaults.company) {
                company = defaults.company;
            }

            let location = locationElements.length
                ? (await locationElements[0].getText()).trim()
                : "";
            if (!location && defaults.location) {
                location = defaults.location;
            }

            if (!title || !company || !href) {
                continue;
            }

            const url = new URL(href, await driver.getCurrentUrl());

            if (!["http:", "https:"].includes(url.protocol)) {
                continue;
            }

            results.push({
                title,
                company,
                location,
                url: url.toString()
            });
        } catch {
            // Skip malformed individual cards without failing the entire page.
            continue;
        }
    }

    return results;
}

module.exports = { extractListingCards };