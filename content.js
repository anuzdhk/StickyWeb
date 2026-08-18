(() => {
  "use strict";

  const HOST_ID = "__stickyweb_shadow_host__";
  const DEFAULT_COLOR = "#fff3a3";
  const COLORS = ["#fff3a3", "#ffd6a5", "#ffadad", "#caffbf", "#a0e7e5", "#cdb4db"];
  const DEFAULT_WIDTH = 288;
  const DEFAULT_HEIGHT = 220;
  const MIN_WIDTH = 210;
  const MIN_HEIGHT = 150;
  const MINIMIZED_SIZE = 46;
  const SAVE_DELAY = 300;
  const TRACKING_PARAMS = new Set([
    "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid",
    "twclid", "ttclid", "gbraid", "wbraid", "yclid", "_hsenc", "_hsmi",
    "mkt_tok", "vero_id", "oly_anon_id", "oly_enc_id"
  ]);

  if (document.getElementById(HOST_ID)) return;

  const state = {
    url: normalizeUrl(location.href),
    notes: [],
    elements: new Map(),
    saveTimer: null,
    zCounter: 10,
    switchingUrl: false,
    ready: false,
    pendingCenteredNote: false
  };

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-stickyweb", "root");
  Object.assign(host.style, {
    all: "initial",
    position: "absolute",
    inset: "0 auto auto 0",
    width: "0",
    height: "0",
    display: "block",
    overflow: "visible",
    zIndex: "2147483646",
    pointerEvents: "none"
  });

  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host, *, *::before, *::after { box-sizing: border-box; }
    #note-layer { position: absolute; inset: 0 auto auto 0; width: 0; height: 0; pointer-events: none; }
    .stickyweb-note {
      --note-color: ${DEFAULT_COLOR};
      position: absolute;
      display: flex;
      flex-direction: column;
      min-width: ${MIN_WIDTH}px;
      min-height: ${MIN_HEIGHT}px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, .62);
      border-radius: 18px;
      background: var(--note-color);
      box-shadow: 0 18px 42px rgba(35, 24, 4, .16), 0 3px 10px rgba(35, 24, 4, .10), inset 0 1px rgba(255, 255, 255, .55);
      color: #2d281e;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
      pointer-events: auto;
      transition: box-shadow .16s ease-out, transform .1s ease-out;
    }
    .stickyweb-note:hover { box-shadow: 0 21px 48px rgba(35, 24, 4, .20), 0 4px 12px rgba(35, 24, 4, .11), inset 0 1px rgba(255, 255, 255, .62); }
    .stickyweb-note.is-dragging, .stickyweb-note.is-resizing { transition: none; box-shadow: 0 25px 58px rgba(35, 24, 4, .24), 0 5px 14px rgba(35, 24, 4, .12); }
    .note-header {
      height: 42px;
      flex: 0 0 42px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 7px 6px 13px;
      border-bottom: 1px solid rgba(63, 46, 9, .08);
      background: rgba(255, 255, 255, .18);
      cursor: move;
      user-select: none;
    }
    .grip { display: grid; grid-template-columns: repeat(3, 3px); gap: 3px; margin-right: auto; opacity: .48; }
    .grip i { width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
    .note-action {
      width: 28px;
      height: 28px;
      display: inline-grid;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: rgba(45, 40, 30, .72);
      cursor: pointer;
      transition: transform 100ms ease-out, background 130ms ease-out;
    }
    .note-action svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .note-action:hover, .note-action:focus-visible { background: rgba(255, 255, 255, .52); color: #211d16; outline: none; }
    .note-action:active, .color-button:active { transform: scale(.9); }
    .delete:hover, .delete:focus-visible { background: rgba(172, 27, 27, .13); color: #8d1515; }
    .note-text {
      width: 100%;
      min-height: 0;
      flex: 1 1 auto;
      resize: none;
      border: 0;
      outline: 0;
      padding: 15px 16px 10px;
      background: transparent;
      color: #2d281e;
      font: 500 15px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    }
    .note-text::placeholder { color: rgba(45, 40, 30, .46); }
    .note-footer { display: flex; align-items: center; gap: 8px; min-height: 41px; padding: 7px 15px 10px; background: rgba(255, 255, 255, .10); }
    .color-button {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, .76);
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(49, 39, 14, .22);
      cursor: pointer;
      transition: transform 100ms ease-out, box-shadow 130ms ease-out;
    }
    .color-button[aria-pressed="true"] { box-shadow: 0 0 0 2px #2d281e; transform: scale(.88); }
    .resize-handle {
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      cursor: nwse-resize;
      opacity: .4;
    }
    .resize-handle svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; transform: rotate(45deg); }
    .mini-icon { display: none; }
    .mini-icon svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .stickyweb-note.is-minimized {
      min-width: 0;
      min-height: 0;
      width: ${MINIMIZED_SIZE}px !important;
      height: ${MINIMIZED_SIZE}px !important;
      border-radius: 50%;
      cursor: move;
    }
    .stickyweb-note.is-minimized .note-header { width: 100%; height: 100%; flex-basis: 100%; justify-content: center; padding: 0; border: 0; }
    .stickyweb-note.is-minimized .grip, .stickyweb-note.is-minimized .note-action,
    .stickyweb-note.is-minimized .note-text, .stickyweb-note.is-minimized .note-footer,
    .stickyweb-note.is-minimized .resize-handle { display: none; }
    .stickyweb-note.is-minimized .mini-icon { display: block; }
    @media (prefers-reduced-motion: reduce) {
      .stickyweb-note, .note-action, .color-button { transition-duration: .01ms !important; }
    }
    @media (prefers-contrast: more) {
      .stickyweb-note { border-color: rgba(45, 40, 30, .78); }
    }
  `;

  const noteLayer = document.createElement("div");
  noteLayer.id = "note-layer";

  shadow.append(style, noteLayer);
  (document.documentElement || document.body).appendChild(host);

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
      return String(input).split("#")[0];
    }
  }

  function makeId() {
    return crypto.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function sanitizeNote(raw) {
    const createdAt = typeof raw?.createdAt === "string" ? raw.createdAt : nowIso();
    return {
      id: typeof raw?.id === "string" ? raw.id : makeId(),
      text: typeof raw?.text === "string" ? raw.text : "",
      x: Math.max(0, finiteNumber(raw?.x, 80)),
      y: Math.max(0, finiteNumber(raw?.y, 80)),
      width: Math.max(MIN_WIDTH, finiteNumber(raw?.width, DEFAULT_WIDTH)),
      height: Math.max(MIN_HEIGHT, finiteNumber(raw?.height, DEFAULT_HEIGHT)),
      color: COLORS.includes(raw?.color) ? raw.color : DEFAULT_COLOR,
      minimized: Boolean(raw?.minimized),
      createdAt,
      updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : createdAt
    };
  }

  function serializeNote(note) {
    return {
      id: note.id,
      text: note.text,
      x: Math.round(note.x),
      y: Math.round(note.y),
      width: Math.round(note.width),
      height: Math.round(note.height),
      color: note.color,
      minimized: note.minimized,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    };
  }

  function touch(note) {
    note.updatedAt = nowIso();
  }

  async function loadNotesForUrl(url) {
    const stored = await chrome.storage.local.get(url);
    const rawNotes = Array.isArray(stored[url]) ? stored[url] : [];
    state.notes = rawNotes.map(sanitizeNote);
    renderAllNotes();
  }

  function queueSave(delay = SAVE_DELAY) {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      state.saveTimer = null;
      persistSnapshot(state.url, state.notes);
    }, delay);
  }

  function persistSnapshot(url, notes) {
    const snapshot = notes.map(serializeNote);
    return chrome.storage.local.set({ [url]: snapshot });
  }

  async function flushSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    await persistSnapshot(state.url, state.notes);
  }

  function applyNoteFrame(element, note) {
    element.style.left = `${Math.round(note.x)}px`;
    element.style.top = `${Math.round(note.y)}px`;
    element.style.setProperty("--note-color", note.color);
    if (!note.minimized) {
      element.style.width = `${Math.round(note.width)}px`;
      element.style.height = `${Math.round(note.height)}px`;
    }
  }

  function bringToFront(element) {
    state.zCounter += 1;
    element.style.zIndex = String(state.zCounter);
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

  function renderAllNotes() {
    state.elements.clear();
    noteLayer.replaceChildren();
    state.notes.forEach(renderNote);
  }

  function renderNote(note) {
    const element = document.createElement("article");
    element.className = "stickyweb-note";
    element.dataset.noteId = note.id;
    element.setAttribute("role", "group");
    element.setAttribute("aria-label", "StickyWeb note");

    const header = document.createElement("header");
    header.className = "note-header";
    header.title = "Drag note";

    const grip = document.createElement("span");
    grip.className = "grip";
    grip.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 6; index += 1) grip.appendChild(document.createElement("i"));

    const miniIcon = document.createElement("span");
    miniIcon.className = "mini-icon";
    miniIcon.setAttribute("aria-hidden", "true");
    miniIcon.appendChild(createHeroIcon("M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m0 13.5h7.5m-7.5 3h4.5m-1.5-16.5H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V10.5a8.25 8.25 0 0 0-8.25-8.25Z"));

    const minimizeButton = document.createElement("button");
    minimizeButton.className = "note-action minimize";
    minimizeButton.type = "button";
    minimizeButton.appendChild(createHeroIcon("M5 12h14"));
    minimizeButton.title = "Minimize note";
    minimizeButton.setAttribute("aria-label", "Minimize note");

    const deleteButton = document.createElement("button");
    deleteButton.className = "note-action delete";
    deleteButton.type = "button";
    deleteButton.appendChild(createHeroIcon("M6 18 18 6M6 6l12 12"));
    deleteButton.title = "Delete note";
    deleteButton.setAttribute("aria-label", "Delete note");

    const textarea = document.createElement("textarea");
    textarea.className = "note-text";
    textarea.value = note.text;
    textarea.placeholder = "Write something…";
    textarea.setAttribute("aria-label", "Sticky note text");
    textarea.spellcheck = true;

    const footer = document.createElement("footer");
    footer.className = "note-footer";
    COLORS.forEach((color) => {
      const button = document.createElement("button");
      button.className = "color-button";
      button.type = "button";
      button.style.background = color;
      button.title = `Set note color to ${color}`;
      button.setAttribute("aria-label", `Set note color to ${color}`);
      button.setAttribute("aria-pressed", String(note.color === color));
      button.addEventListener("click", () => {
        note.color = color;
        touch(note);
        element.style.setProperty("--note-color", color);
        footer.querySelectorAll(".color-button").forEach((item) => {
          item.setAttribute("aria-pressed", String(item === button));
        });
        queueSave();
      });
      footer.appendChild(button);
    });

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "resize-handle";
    resizeHandle.title = "Resize note";
    resizeHandle.setAttribute("aria-hidden", "true");
    resizeHandle.appendChild(createHeroIcon("M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15M3.75 20.25h4.5m-4.5 0v-4.5m0 4.5L9 15"));

    header.append(grip, miniIcon, minimizeButton, deleteButton);
    element.append(header, textarea, footer, resizeHandle);
    noteLayer.appendChild(element);
    state.elements.set(note.id, element);
    applyNoteFrame(element, note);
    element.classList.toggle("is-minimized", note.minimized);
    bringToFront(element);

    textarea.addEventListener("input", () => {
      note.text = textarea.value;
      touch(note);
      queueSave(450);
    });

    minimizeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setMinimized(note, element, true);
    });

    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const preview = note.text.trim().replace(/\s+/g, " ").slice(0, 70);
      const message = preview ? `Delete this note?\n\n“${preview}${note.text.trim().length > 70 ? "…" : ""}”` : "Delete this empty note?";
      if (!confirm(message)) return;
      state.notes = state.notes.filter((item) => item.id !== note.id);
      state.elements.delete(note.id);
      element.remove();
      persistSnapshot(state.url, state.notes);
    });

    installNoteDrag(header, element, note);
    installNoteResize(resizeHandle, element, note);
  }

  function setMinimized(note, element, minimized) {
    note.minimized = minimized;
    touch(note);
    element.classList.toggle("is-minimized", minimized);
    applyNoteFrame(element, note);
    element.setAttribute("aria-label", minimized ? "Minimized sticky note; click to expand" : "StickyWeb note");
    queueSave();
  }

  function installNoteDrag(handle, element, note) {
    let moved = false;

    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      event.preventDefault();
      moved = false;
      bringToFront(element);
      element.classList.add("is-dragging");

      const startPointerX = event.clientX + window.scrollX;
      const startPointerY = event.clientY + window.scrollY;
      const startX = note.x;
      const startY = note.y;

      const onMove = (moveEvent) => {
        const pointerX = moveEvent.clientX + window.scrollX;
        const pointerY = moveEvent.clientY + window.scrollY;
        const deltaX = pointerX - startPointerX;
        const deltaY = pointerY - startPointerY;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 3) moved = true;
        note.x = Math.max(0, startX + deltaX);
        note.y = Math.max(0, startY + deltaY);
        touch(note);
        applyNoteFrame(element, note);
        queueSave();
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        element.classList.remove("is-dragging");
        if (moved) flushSave();
        else if (note.minimized) setMinimized(note, element, false);
      };

      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    });
  }

  function installNoteResize(handle, element, note) {
    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || note.minimized) return;
      event.preventDefault();
      event.stopPropagation();
      bringToFront(element);
      element.classList.add("is-resizing");

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startWidth = note.width;
      const startHeight = note.height;

      const onMove = (moveEvent) => {
        note.width = Math.max(MIN_WIDTH, startWidth + moveEvent.clientX - startClientX);
        note.height = Math.max(MIN_HEIGHT, startHeight + moveEvent.clientY - startClientY);
        touch(note);
        applyNoteFrame(element, note);
        queueSave();
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        element.classList.remove("is-resizing");
        flushSave();
      };

      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    });
  }

  function defaultNotePosition(centered = false) {
    if (centered) {
      return {
        x: Math.max(16, window.scrollX + (window.innerWidth - DEFAULT_WIDTH) / 2),
        y: Math.max(16, window.scrollY + (window.innerHeight - DEFAULT_HEIGHT) / 2)
      };
    }

    const stagger = state.notes.length % 6;
    return {
      x: Math.max(16, window.scrollX + Math.min(80 + stagger * 24, Math.max(16, window.innerWidth - DEFAULT_WIDTH - 24))),
      y: Math.max(16, window.scrollY + Math.min(80 + stagger * 24, Math.max(16, window.innerHeight - DEFAULT_HEIGHT - 24)))
    };
  }

  function createNote(centered = false) {
    if (!state.ready) {
      if (centered) state.pendingCenteredNote = true;
      return;
    }
    const position = defaultNotePosition(centered);
    const timestamp = nowIso();
    const note = {
      id: makeId(),
      text: "",
      x: position.x,
      y: position.y,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      color: DEFAULT_COLOR,
      minimized: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    state.notes.push(note);
    renderNote(note);
    persistSnapshot(state.url, state.notes);
    state.elements.get(note.id)?.querySelector(".note-text")?.focus();
  }

  async function switchUrlIfNeeded() {
    const nextUrl = normalizeUrl(location.href);
    if (nextUrl === state.url || state.switchingUrl) return;
    state.switchingUrl = true;
    try {
      await flushSave();
      state.url = nextUrl;
      await loadNotesForUrl(nextUrl);
    } finally {
      state.switchingUrl = false;
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "STICKYWEB_CREATE_AT_CENTER") createNote(true);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state.saveTimer) flushSave();
  });
  window.addEventListener("pagehide", () => {
    if (state.saveTimer) flushSave();
  });

  loadNotesForUrl(state.url)
    .catch(() => {})
    .finally(() => {
      state.ready = true;
      if (state.pendingCenteredNote) {
        state.pendingCenteredNote = false;
        createNote(true);
      }
    });
  setInterval(switchUrlIfNeeded, 800);
})();
