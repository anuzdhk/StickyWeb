"use strict";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove("__stickyweb_ui__");
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "create-note") return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return;

  try {
    await chrome.tabs.sendMessage(activeTab.id, {
      type: "STICKYWEB_CREATE_AT_CENTER"
    });
  } catch {
    // Chrome internal pages and some protected pages cannot run content scripts.
  }
});
