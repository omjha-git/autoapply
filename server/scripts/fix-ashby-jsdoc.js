var fs = require("fs");
var ashbyPath = "C:/Users/jhaom/OneDrive/Desktop/autoapply marks2/AutoApply/server/services/jobSearch/ashby.js";
var c = fs.readFileSync(ashbyPath, "utf8");
if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);

// Fix stale JSDoc comment - replace old field names with real ones
c = c.replace(/"descriptionHTML"/g, '"descriptionHtml"');
c = c.replace(/"href": "https:\/\/ashbyhq\.com\/company\/jobs\/1234"/, '"jobUrl": "https://jobs.ashbyhq.com/ramp/job-1234"');
c = c.replace(/"compensation": \{ "min": 150000, "max": 200000, "currency": "USD", "period": "year" \}/, '"compensation": { "summaryComponents": [{"compensationType":"Salary","interval":"1 YEAR","currencyCode":"USD","minValue":150000,"maxValue":200000}] }');
c = c.replace(/"createdAt": 1690848000,             \/\/ unix epoch seconds\n \*         "updatedAt": 1696118400/, '"publishedAt": "2023-08-01T00:00:00.000Z"');
c = c.replace(/"jobPostings": \[/, '"jobs": [');

fs.writeFileSync(ashbyPath, c);
console.log("JSDoc fixed");
// Verify
var after = fs.readFileSync(ashbyPath, "utf8");
console.log("descriptionHTML remaining: " + (after.match(/descriptionHTML/g) || []).length);
console.log("jobPostings remaining: " + (after.match(/jobPostings/g) || []).length);
console.log("href remaining: " + (after.match(/"href"/g) || []).length);
