browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type !== "pixelCount" || sender.tab?.id == null) return;
    const tabId = sender.tab.id;
    return Promise.all([
        browser.action.setBadgeText({ tabId, text: message.count ? String(message.count) : "" }),
        browser.action.setBadgeBackgroundColor({ tabId, color: "#E74D4D" }),
    ]);
});
