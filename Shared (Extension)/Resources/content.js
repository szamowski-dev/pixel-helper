(() => {
const events = [];
const seen = new Set();
let lastPixelCount = -1;

function parsePixelRequest(resource) {
    let url;
    try {
        url = new URL(resource.name);
    } catch {
        return null;
    }

    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    const query = url.searchParams;
    let provider;
    let id;
    let name;
    let kind = "event";

    if ((host === "www.google-analytics.com" || host.endsWith(".google-analytics.com") || host === "analytics.google.com" || host.endsWith(".analytics.google.com")) && ["/g/collect", "/collect", "/j/collect"].includes(path)) {
        provider = "Google tag";
        id = query.get("tid");
        name = query.get("en") || query.get("t");
    } else if ((host === "www.googleadservices.com" || host === "googleads.g.doubleclick.net") && path.startsWith("/pagead/") && path.includes("conversion")) {
        provider = "Google tag";
        id = path.match(/(?:viewthroughconversion|conversion)\/([^/]+)/)?.[1];
        name = "Conversion";
    } else if (host === "www.facebook.com" && path === "/tr/") {
        provider = "Meta Pixel";
        id = query.get("id");
        name = query.get("ev");
    } else if ((host === "analytics.twitter.com" || host === "analytics.x.com") && /^\/(?:1\/)?i\/adsctp?$/.test(path)) {
        provider = "X Pixel";
        id = query.get("txn_id");
        name = query.get("event") || query.get("ev");
    } else if (host === "alb.reddit.com" && path === "/rp.gif") {
        provider = "Reddit Pixel";
        id = query.get("id");
        name = query.get("event");
    } else if (host === "pixel-config.reddit.com" && /^\/pixels\/[^/]+\/config$/.test(path)) {
        provider = "Reddit Pixel";
        id = path.split("/")[2];
        kind = "configuration";
    } else if (host === "analytics.tiktok.com" && (path === "/api/v2/pixel" || path.startsWith("/api/v2/pixel/"))) {
        provider = "TikTok Pixel";
        id = query.get("pixel_code") || query.get("id");
        name = query.get("event");
    } else {
        return null;
    }

    return {
        provider,
        id: id || null,
        name: name || null,
        kind,
        time: Math.round(performance.timeOrigin + resource.startTime),
        endpoint: `${host}${path}`,
        parameters: [...query.entries()],
    };
}

function record(resources) {
    for (const resource of resources) {
        const event = parsePixelRequest(resource);
        if (!event) continue;
        const key = `${resource.startTime}:${resource.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push(event);
    }
    if (events.length > 100) {
        events.splice(0, events.length - 100);
        seen.clear();
    }
    const count = new Set(events.map((event) => JSON.stringify([event.provider, event.id]))).size;
    if (count !== lastPixelCount) {
        lastPixelCount = count;
        browser.runtime.sendMessage({ type: "pixelCount", count }).catch(() => {});
    }
}

record(performance.getEntriesByType("resource"));
new PerformanceObserver((list) => record(list.getEntries())).observe({ type: "resource", buffered: true });

browser.runtime.onMessage.addListener((message) => {
    if (message.type === "getEvents") return Promise.resolve(events);
});
})();
