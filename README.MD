# Pixel Helper for Safari

An open-source Safari extension that shows the tracking pixels detected on the current website. Select a provider icon to inspect its pixel IDs and observed events. The toolbar badge shows a per-tab count, and the popup has a light/dark switch.

It currently recognizes Google tags, Meta Pixel, X Pixel, Reddit Pixel, and TikTok Pixel. Safari asks you to grant website access before the extension can inspect a page. Reload the page after granting access.

## Build from source

1. Open `Pixel Helper.xcodeproj` in Xcode.
2. Select the `Pixel Helper (macOS)` scheme and your Mac as the destination, then build and run the app.
3. Enable Pixel Helper in Safari → Settings → Extensions and allow access to the websites you want to inspect.

The project also contains a `Pixel Helper (iOS)` scheme for iPhone and iPad. To distribute a build outside the App Store, use your own Apple signing and notarization setup where applicable. The source is free under the [MIT License](LICENSE).

A ready-to-install Mac App Store version is planned for **US$5** for people who prefer not to build and sign the extension themselves. It is not available yet.

## What the results mean

Pixel Helper observes resource request URLs locally in the browser. It does not send browsing data to our servers. It shows URL parameter **names**, not their values. A detected configuration, such as Reddit's pixel config request, means the pixel is installed; it does not prove an event was sent. For beacons that put details in a POST body, such as X, the pixel ID and event name may be unavailable. The extension cannot confirm delivery or inspect server-side Conversion API events.

The toolbar badge counts distinct detected provider and pixel ID pairs on the current tab. It clears on a new page with no detected pixels.

## App icon

`AppIcon.icon` is the editable Icon Composer document for the macOS and iOS host apps. The app icon asset catalog also contains a PNG fallback. Safari's toolbar and extension icons are separate PNGs in `Shared (Extension)/Resources/images/`, generated from an Icon Composer export.

## Development

Run the parser and badge check with:

```sh
node tests/pixel-events.test.cjs
```

This project is independent and is not affiliated with Google, Meta, X, Reddit, TikTok, or Apple.
The provider marks in the popup come from [Simple Icons](https://simpleicons.org/) (CC0); brand names and logos remain their owners' trademarks.
