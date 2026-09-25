const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const resources = [
    "https://www.google-analytics.com/g/collect?tid=G-123&en=page_view&cid=private",
    "https://www.facebook.com/tr/?id=12345&ev=Purchase&cd[value]=99",
    "https://analytics.twitter.com/1/i/adsctp",
    "https://pixel-config.reddit.com/pixels/a2_j1933bxzyyfr/config",
    "https://analytics.tiktok.com/api/v2/pixel",
    "https://www.redditstatic.com/ads/pixel.js",
].map((name, startTime) => ({ name, startTime }));

let listener;
let observer;
const badgeMessages = [];
const context = {
    URL,
    Promise,
    performance: { timeOrigin: 1000, getEntriesByType: () => resources },
    browser: { runtime: { onMessage: { addListener: (value) => { listener = value; } }, sendMessage: (value) => { badgeMessages.push(value); return Promise.resolve(); } } },
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
    assert.equal(events[0].endpoint, "www.google-analytics.com/g/collect");
    assert.equal(events[1].id, "12345");
    assert.equal(events[2].id, null); // X sends this beacon's details in a body we cannot inspect.
    assert.equal(events[3].id, "a2_j1933bxzyyfr");
    assert.equal(events[3].kind, "configuration");
    assert.equal(events[4].name, null); // TikTok sends its event name in the POST body.
    assert.equal(events[1].parameters.find(([key]) => key === "cd[value]")[1], "99");
    assert.equal(events[0].parameters.find(([key]) => key === "cid")[1], "private");
    assert.equal(badgeMessages.length, 1); // Buffered observer replay must not update the badge twice.
    assert.equal(badgeMessages[0].count, 5);
    observer({ getEntries: () => [{ name: "https://www.facebook.com/tr/?id=second&ev=PageView", startTime: 6 }] });
    assert.equal(badgeMessages.at(-1).count, 6);

    let backgroundListener;
    const badgeText = [];
    const badgeColor = [];
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../Shared (Extension)/Resources/background.js"), "utf8"), {
        browser: {
            runtime: { onMessage: { addListener: (value) => { backgroundListener = value; } } },
            action: {
                setBadgeText: (value) => { badgeText.push(value); return Promise.resolve(); },
                setBadgeBackgroundColor: (value) => { badgeColor.push(value); return Promise.resolve(); },
            },
        },
    });
    await backgroundListener({ type: "pixelCount", count: 5 }, { tab: { id: 42 } });
    await backgroundListener({ type: "pixelCount", count: 0 }, { tab: { id: 42 } });
    assert.deepEqual(badgeText.map(({ tabId, text }) => [tabId, text]), [[42, "5"], [42, ""]]);
    assert.equal(badgeColor[0].color, "#E74D4D");

    class Element {
        constructor() { this.dataset = {}; this.children = []; this.attributes = {}; this.listeners = {}; this.hidden = true; }
        setAttribute(name, value) { this.attributes[name] = value; }
        getAttribute(name) { return this.attributes[name]; }
        addEventListener(name, value) { this.listeners[name] = value; }
        append(...children) { this.children.push(...children); }
        replaceChildren() { this.children = []; }
    }
    const toggle = new Element();
    const headline = new Element();
    const hint = new Element();
    const pixels = new Element();
    const buttons = ["Google tag", "Meta Pixel", "TikTok Pixel", "Reddit Pixel", "X Pixel"].map((provider) => {
        const button = new Element();
        button.dataset.provider = provider;
        button.setAttribute("aria-label", provider.split(" ")[0]);
        return button;
    });
    const elements = { "#theme-toggle": toggle, "#headline": headline, "#hint": hint, "#pixels": pixels };
    const popup = {
        URL,
        document: {
            documentElement: { dataset: {} },
            querySelector: (selector) => elements[selector],
            querySelectorAll: () => buttons,
            createElement: () => new Element(),
        },
        browser: { tabs: { query: async () => [{ id: 42, url: "https://horacal.app" }], sendMessage: async () => events } },
        localStorage: { getItem: () => null, setItem: () => {} },
        matchMedia: () => ({ matches: false }),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../Shared (Extension)/Resources/popup.js"), "utf8"), popup);
    await new Promise(setImmediate);
    assert.equal(headline.textContent, "6 pixels found on horacal.app");
    assert.equal(pixels.hidden, true); // Details appear only after choosing a provider.
    assert.equal(buttons[3].dataset.detected, "true");
    buttons[3].listeners.click();
    assert.equal(pixels.children.length, 1);
    assert.equal(pixels.children[0].children[0].textContent, "Reddit Pixel");
    assert.equal(pixels.children[0].children[2].textContent, "No pixel events observed");
    assert.equal(buttons[3].getAttribute("aria-pressed"), "true");
    buttons[0].listeners.click();
    assert.equal(pixels.children[0].children[0].textContent, "Google tag");
    assert.equal(pixels.children[0].children[1].textContent, "Tag ID: G-123");
    assert.equal(pixels.children[0].children[3].children[1].children[0].textContent, "Event details");
    assert.equal(buttons[3].getAttribute("aria-pressed"), "false");
    popup.browser.tabs.sendMessage = async () => [events[0], { ...events[0], id: "G-OTHER" }];
    await popup.load();
    buttons[0].listeners.click();
    assert.equal(pixels.children.length, 2);
    assert.equal(pixels.children[1].children[1].textContent, "Tag ID: G-OTHER");
    toggle.checked = true;
    toggle.listeners.change();
    assert.equal(popup.document.documentElement.dataset.theme, "dark");
    assert.equal(toggle.getAttribute("aria-checked"), "true");
    const grouped = popup.groupEvents([events[0], events[0], events[1]]);
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].events.length, 2);
    assert.equal(grouped[1].provider, "Meta Pixel");
    popup.browser.tabs.sendMessage = async () => [];
    await popup.load();
    assert.equal(headline.textContent, "0 pixels found on horacal.app");
    observer({ getEntries: () => [{ name: "https://region1.analytics.google.com/g/collect?tid=G-ANTYWEB&en=page_view", startTime: 7 }] });
    assert.equal((await listener({ type: "getEvents" })).at(-1).id, "G-ANTYWEB");
    assert.equal(badgeMessages.at(-1).count, 7);
    console.log("Pixel request parsing passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
