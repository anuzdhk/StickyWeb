"use strict";

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid",
  "twclid", "ttclid", "gbraid", "wbraid", "yclid", "_hsenc", "_hsmi",
  "mkt_tok", "vero_id", "oly_anon_id", "oly_enc_id"
]);

const pageLabel = document.getElementById("page-label");
const pageSummary = document.getElementById("page-summary");
const totalCount = document.getElementById("total-count");
const shortcutLabel = document.getElementById("shortcut");
const statusLabel = document.getElementById("status");
const addNoteButton = document.getElementById("add-note");
const viewAllButton = document.getElementById("view-all");
const editShortcutButton = document.getElementById("edit-shortcut");

let activeTab = null;

function normalizeUrl(input) {
  try {
    const url = new URL(input);
    url.hash = "";
    const retained = [];
    for (const [key, value] of url.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith("utm_") || TRACKING_PARAMS.has(lowerKey)) continue;
      retained.push([key, value]);
    }
    retained.sort(([aKey, aValue], [bKey, bValue]) =>
      aKey.localeCompare(bKey) || aValue.localeCompare(bValue)
    );
    url.search = "";
    retained.forEach(([key, value]) => url.searchParams.append(key, value));
    return url.toString();
  } catch {
    return String(input || "").split("#")[0];
  }
}

function displayPageName(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") return "Local file";
    return parsed.hostname || "Current webpage";
  } catch {
    return "Current webpage";
  }
}

function shortcutText(value) {
  if (!value) return "Not set";
  return value.replaceAll("+", " + ");
}

function showStatus(message) {
  statusLabel.textContent = message;
}

async function initialize() {
  const [[tab], commands, storage] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.commands.getAll(),
    chrome.storage.local.get(null)
  ]);

  activeTab = tab || null;
  const noteGroups = Object.values(storage).filter(Array.isArray);
  const allNoteCount = noteGroups.reduce((count, notes) => count + notes.length, 0);
  const currentUrl = activeTab?.url ? normalizeUrl(activeTab.url) : "";
  const currentPageCount = Array.isArray(storage[currentUrl]) ? storage[currentUrl].length : 0;
  const command = commands.find((item) => item.name === "create-note");

  pageLabel.textContent = displayPageName(activeTab?.url);
  pageSummary.textContent = `${currentPageCount} note${currentPageCount === 1 ? "" : "s"} saved on this page`;
  totalCount.textContent = String(allNoteCount);
  shortcutLabel.textContent = shortcutText(command?.shortcut);

  const supportedPage = /^(https?|file):/i.test(activeTab?.url || "");
  if (!supportedPage) {
    addNoteButton.disabled = true;
    pageSummary.textContent = "Notes are unavailable on this Chrome page";
  }
}

addNoteButton.addEventListener("click", async () => {
  if (!activeTab?.id) return;
  showStatus("");
  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: "STICKYWEB_CREATE_AT_CENTER" });
    window.close();
  } catch {
    showStatus("Reload this webpage once, then try again.");
  }
});

viewAllButton.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
  window.close();
});

editShortcutButton.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  window.close();
});

initialize().catch(() => {
  pageSummary.textContent = "StickyWeb is ready";
  showStatus("Could not read this page. Try reopening the popup.");
});
