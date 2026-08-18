"use strict";

const searchInput = document.getElementById("search");
const domainSelect = document.getElementById("domain");
const notesContainer = document.getElementById("notes");
const countLabel = document.getElementById("count");
const exportButton = document.getElementById("export");
const shortcutsButton = document.getElementById("shortcuts");
const shortcutSummary = document.getElementById("shortcut-summary");

let storedNotesByUrl = {};
let allNotes = [];

function domainFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") return "Local files";
    return parsed.hostname || parsed.protocol.replace(":", "");
  } catch {
    return "Other";
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function createHeroIcon(pathData) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  svg.appendChild(path);
  return svg;
}

function flattenNotes(storage) {
  storedNotesByUrl = Object.fromEntries(
    Object.entries(storage).filter(([, value]) => Array.isArray(value))
  );

  allNotes = Object.entries(storedNotesByUrl).flatMap(([url, notes]) =>
    notes.map((note) => ({ ...note, url, domain: domainFromUrl(url) }))
  );
  allNotes.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function rebuildDomainFilter() {
  const selected = domainSelect.value;
  const domains = [...new Set(allNotes.map((note) => note.domain))].sort((a, b) => a.localeCompare(b));
  domainSelect.replaceChildren(new Option("All websites", ""));
  domains.forEach((domain) => domainSelect.add(new Option(domain, domain)));
  if (domains.includes(selected)) domainSelect.value = selected;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const selectedDomain = domainSelect.value;
  const visible = allNotes.filter((note) => {
    const matchesText = !query || String(note.text || "").toLocaleLowerCase().includes(query);
    const matchesDomain = !selectedDomain || note.domain === selectedDomain;
    return matchesText && matchesDomain;
  });

  notesContainer.replaceChildren();
  countLabel.textContent = `${visible.length} of ${allNotes.length} note${allNotes.length === 1 ? "" : "s"}`;

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const title = document.createElement("strong");
    title.textContent = allNotes.length ? "No matching notes" : "No notes yet";
    const description = document.createElement("span");
    description.textContent = allNotes.length
      ? "Try a different search or domain filter."
      : "Open a webpage and use the purple + button to create your first note.";
    empty.append(title, description);
    notesContainer.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  visible.forEach((note) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.setProperty("--note-color", note.color || "#fff3a3");

    const main = document.createElement("div");
    main.className = "card-main";
    const text = document.createElement("p");
    text.className = "note-text";
    if (String(note.text || "").trim()) text.textContent = note.text;
    else {
      text.classList.add("empty-text");
      text.textContent = "Empty note";
    }
    main.appendChild(text);

    const footer = document.createElement("footer");
    footer.className = "card-footer";
    const domain = document.createElement("span");
    domain.className = "domain";
    domain.textContent = note.domain;
    domain.title = note.url;
    const date = document.createElement("time");
    date.className = "date";
    date.dateTime = note.updatedAt || note.createdAt || "";
    date.textContent = formatDate(note.updatedAt || note.createdAt);
    const link = document.createElement("a");
    link.className = "open-link";
    link.href = note.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Open saved webpage";
    link.setAttribute("aria-label", `Open ${note.domain}`);
    link.appendChild(createHeroIcon("M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 3L21 3m0 0h-5.25M21 3v5.25"));
    footer.append(domain, date, link);

    card.append(main, footer);
    fragment.appendChild(card);
  });
  notesContainer.appendChild(fragment);
}

async function loadNotes() {
  const [storage, commands] = await Promise.all([
    chrome.storage.local.get(null),
    chrome.commands.getAll()
  ]);
  flattenNotes(storage);
  const command = commands.find((item) => item.name === "create-note");
  shortcutSummary.textContent = command?.shortcut ? command.shortcut.replaceAll("+", " + ") : "Not set";
  rebuildDomainFilter();
  render();
}

function exportNotes() {
  const json = JSON.stringify(storedNotesByUrl, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `stickyweb-notes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

searchInput.addEventListener("input", render);
domainSelect.addEventListener("change", render);
exportButton.addEventListener("click", exportNotes);
shortcutsButton.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "local") loadNotes();
});

loadNotes();
