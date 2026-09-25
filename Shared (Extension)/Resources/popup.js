const headline = document.querySelector("#headline");
const hint = document.querySelector("#hint");
const pixels = document.querySelector("#pixels");
const themeToggle = document.querySelector("#theme-toggle");
const providerButtons = [...document.querySelectorAll(".provider-tabs button")];
let groups = [];
let host = "";

document.documentElement.dataset.theme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
themeToggle.checked = document.documentElement.dataset.theme === "dark";
themeToggle.setAttribute("aria-checked", String(themeToggle.checked));
themeToggle.addEventListener("change", () => {
    document.documentElement.dataset.theme = themeToggle.checked ? "dark" : "light";
    localStorage.setItem("theme", document.documentElement.dataset.theme);
    themeToggle.setAttribute("aria-checked", String(themeToggle.checked));
});

function groupEvents(events) {
    const groups = new Map();
    for (const event of events) {
        const key = JSON.stringify([event.provider, event.id]);
        if (!groups.has(key)) groups.set(key, { provider: event.provider, id: event.id, events: [] });
        groups.get(key).events.push(event);
    }
    return [...groups.values()];
}

function showProvider(button) {
    for (const item of providerButtons) item.setAttribute("aria-pressed", String(item === button));
    pixels.replaceChildren();
    pixels.hidden = false;
    hint.hidden = true;
    const selected = groups.filter((group) => group.provider === button.dataset.provider);
    for (const group of selected) {
        const card = document.createElement("section");
        card.className = "pixel";
        const provider = document.createElement("h2");
        provider.className = "provider";
        provider.textContent = group.provider;
        const id = document.createElement("p");
        id.className = "pixel-id";
        id.textContent = `${group.provider === "Google tag" ? "Tag ID" : "Pixel ID"}: ${group.id || "Unavailable from request URL"}`;
        const observedEvents = group.events.filter((event) => event.kind !== "configuration");
        const label = document.createElement("p");
        label.className = "events-label";
        label.textContent = observedEvents.length ? "Observed events" : "No pixel events observed";
        card.append(provider, id, label);

        for (const event of observedEvents.reverse()) {
            const row = document.createElement("details");
            const summary = document.createElement("summary");
            const name = document.createElement("span");
            name.className = "event-name";
            name.textContent = event.name || "Event observed · details unavailable";
            const time = document.createElement("time");
            time.textContent = new Date(event.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
            summary.append(name, time);
            const eventDetails = document.createElement("div");
            eventDetails.className = "event-details";
            const detailsHeading = document.createElement("h3");
            detailsHeading.textContent = "Event details";
            const detailsList = document.createElement("dl");
            for (const [label, value] of [
                ["Timestamp", new Date(event.time).toLocaleString()],
                ["Request endpoint", event.endpoint],
            ]) {
                const term = document.createElement("dt");
                term.textContent = label;
                const description = document.createElement("dd");
                description.textContent = value;
                detailsList.append(term, description);
            }
            eventDetails.append(detailsHeading, detailsList);
            const parametersHeading = document.createElement("h3");
            parametersHeading.textContent = "Parameter details";
            const parametersList = document.createElement("dl");
            for (const [key, value] of event.parameters) {
                const term = document.createElement("dt");
                term.textContent = key;
                const description = document.createElement("dd");
                description.textContent = value || "(empty)";
                parametersList.append(term, description);
            }
            if (!event.parameters.length) parametersList.textContent = "No URL parameters observed.";
            eventDetails.append(parametersHeading, parametersList);
            row.append(summary, eventDetails);
            card.append(row);
        }
        pixels.append(card);
    }
}

for (const button of providerButtons) button.addEventListener("click", () => showProvider(button));

async function load() {
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !/^https?:/.test(tab.url || "")) {
            headline.textContent = "Open a website to inspect its pixels.";
            return;
        }

        host = new URL(tab.url).hostname;
        const events = await browser.tabs.sendMessage(tab.id, { type: "getEvents" });
        groups = groupEvents(events);
        headline.textContent = `${groups.length} ${groups.length === 1 ? "pixel" : "pixels"} found on ${host}`;
        for (const button of providerButtons) {
            const detected = groups.some((group) => group.provider === button.dataset.provider);
            button.disabled = !detected;
            button.dataset.detected = String(detected);
        }
        if (!groups.length) return;
        hint.hidden = false;
    } catch {
        headline.textContent = "Allow this extension on the website, then reload the page.";
    }
}

load();
