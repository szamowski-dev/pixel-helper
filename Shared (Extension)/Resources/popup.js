const status = document.querySelector("#status");
const list = document.querySelector("#events");

async function load() {
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !/^https?:/.test(tab.url || "")) {
            status.textContent = "Open a website to inspect its pixel requests.";
            return;
        }

        document.querySelector("#site").textContent = new URL(tab.url).hostname;
        const events = await browser.tabs.sendMessage(tab.id, { type: "getEvents" });
        document.querySelector("#count").textContent = events.length;
        if (!events.length) {
            status.textContent = "No supported pixel requests observed. Reload the page after granting website access.";
            return;
        }

        status.hidden = true;
        list.hidden = false;
        for (const event of [...events].reverse()) {
            const item = document.createElement("li");
            const heading = document.createElement("div");
            heading.className = "event-heading";
            const provider = document.createElement("strong");
            provider.textContent = event.provider;
            const time = document.createElement("time");
            time.textContent = new Date(event.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
            heading.append(provider, time);
            const name = document.createElement("div");
            name.className = "event-name";
            name.textContent = event.name || "Event name unavailable";
            const details = document.createElement("div");
            details.className = "event-details";
            details.textContent = `ID: ${event.id || "unavailable"}`;
            item.append(heading, name, details);
            if (event.parameters.length) {
                const parameters = document.createElement("details");
                const summary = document.createElement("summary");
                summary.textContent = `${event.parameters.length} URL parameter names`;
                const names = document.createElement("div");
                names.className = "parameter-names";
                names.textContent = event.parameters.join(", ");
                parameters.append(summary, names);
                item.append(parameters);
            }
            list.append(item);
        }
    } catch {
        status.textContent = "Allow this extension on the website, then reload the page.";
    }
}

load();
