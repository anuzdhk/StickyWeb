# StickyWeb

StickyWeb is a vanilla JavaScript Chrome extension (Manifest V3) for placing persistent sticky notes on webpages. Each page is identified by a normalized URL that keeps its path and meaningful query parameters while removing common tracking parameters.

## Install locally

1. Extract the ZIP.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted `StickyWeb` folder.
5. Open or reload a normal webpage. Click the StickyWeb toolbar icon and choose **Add Note**.

Chrome does not allow extensions to inject UI into protected pages such as `chrome://extensions` or the Chrome Web Store. To use StickyWeb on local `file://` pages, enable **Allow access to file URLs** in the extension details.

## Usage

- Click the StickyWeb extension icon to open the Apple-inspired popup.
- Choose **Add Note** to create a note at the center of the current viewport.
- Choose **View All Notes** to open the searchable note library.
- Drag a note by its header.
- Resize it from its bottom-right corner.
- Choose among six preset colors.
- Use the minimize control and click the minimized note to expand it.
- Use the close control to delete after confirmation.
- Press **Alt+Shift+S** to create a note at the center of the current viewport.
- Use **Edit** beside the shortcut tip to customize the command in Chrome's extension shortcut settings.

If Chrome reports a keyboard-shortcut conflict, set the shortcut manually at `chrome://extensions/shortcuts`.

## Storage schema

Notes are stored in `chrome.storage.local`, keyed by normalized page URL:

```json
{
  "https://example.com/path?meaningful=value": [
    {
      "id": "uuid",
      "text": "Example note",
      "x": 120,
      "y": 480,
      "width": 288,
      "height": 220,
      "color": "#fff3a3",
      "minimized": false,
      "createdAt": "2026-08-18T00:00:00.000Z",
      "updatedAt": "2026-08-18T00:00:00.000Z"
    }
  ]
}
```

Notes use document coordinates, so they stay attached to the same page location while the viewport scrolls.

## Project structure

```text
StickyWeb/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.css
├── popup.js
├── options.html
├── options.js
├── README.md
└── icons/
    ├── logo.svg
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
