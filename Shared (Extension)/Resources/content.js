const events = [];
const seen = new Set();

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

    if ((host === "www.google-analytics.com" || host.endsWith(".google-analytics.com")) && ["/g/collect", "/collect", "/j/collect"].includes(path)) {
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
    } else if ((host === "analytics.twitter.com" || host === "analytics.x.com" || host === "t.co") && (path === "/i/adsct" || path === "/1/i/adsct")) {
        provider = "X Pixel";
        id = query.get("txn_id");
        name = query.get("event") || "Conversion";
    } else if (host === "alb.reddit.com" && path === "/rp.gif") {
        provider = "Reddit Pixel";
        id = query.get("id");
        name = query.get("event");
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
        time: Math.round(performance.timeOrigin + resource.startTime),
        parameters: [...new Set(query.keys())].sort(),
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
}

record(performance.getEntriesByType("resource"));
new PerformanceObserver((list) => record(list.getEntries())).observe({ type: "resource", buffered: true });

browser.runtime.onMessage.addListener((message) => {
    if (message.type === "getEvents") return Promise.resolve(events);
});
