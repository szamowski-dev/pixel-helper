const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const resources = [
    "https://www.google-analytics.com/g/collect?tid=G-123&en=page_view&cid=private",
    "https://www.facebook.com/tr/?id=12345&ev=Purchase&cd[value]=99",
    "https://analytics.twitter.com/1/i/adsct?txn_id=x123&tw_sale_amount=99",
    "https://alb.reddit.com/rp.gif?id=reddit123&event=PageVisit&em=private",
    "https://analytics.tiktok.com/api/v2/pixel",
    "https://www.redditstatic.com/ads/pixel.js",
].map((name, startTime) => ({ name, startTime }));

let listener;
let observer;
const context = {
    URL,
    Promise,
    performance: { timeOrigin: 1000, getEntriesByType: () => resources },
    browser: { runtime: { onMessage: { addListener: (value) => { listener = value; } } } },
    PerformanceObserver: class {
        constructor(callback) { observer = callback; }
        observe() {}
    },
};

vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../Shared (Extension)/Resources/content.js"), "utf8"), context);

(async () => {
    observer({ getEntries: () => resources }); // Safari can replay buffered entries.
    const events = await listener({ type: "getEvents" });
    assert.equal(events.length, 5);
    assert.deepEqual(Array.from(events, (event) => event.provider), ["Google tag", "Meta Pixel", "X Pixel", "Reddit Pixel", "TikTok Pixel"]);
    assert.equal(events[0].name, "page_view");
    assert.equal(events[1].id, "12345");
    assert.equal(events[4].name, null); // TikTok sends its event name in the POST body.
    assert.ok(events[1].parameters.includes("cd[value]"));
    assert.ok(!JSON.stringify(events).includes("private"));
    console.log("Pixel request parsing passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
