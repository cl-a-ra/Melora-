(() => {
  "use strict";

  const STORAGE_KEY = "playlist-arranger-demo:v1";
  const DATA_VERSION = 1;
  const APPEARANCE_STORAGE_KEY = "playlist-arranger-appearance:v1";
  const APPEARANCE_VERSION = 1;
  const appearanceChoices = {
    colorMode: ["system", "dark", "light"],
    colorTheme: ["forest", "ocean", "berry", "sunset"],
    font: ["system", "serif", "mono"]
  };
  const playlists = [
    {
      id: "quiet-mornings",
      name: "Quiet Mornings",
      description: "Gentle fictional instrumentals for a slow start.",
      tracks: [
        { id: "paper-sunrise", title: "Paper Sunrise", artist: "Mira Vale" },
        { id: "window-light", title: "Window Light", artist: "The Small Hours" },
        { id: "tea-and-clouds", title: "Tea and Clouds", artist: "Juniper Radio" },
        { id: "softly-awake", title: "Softly Awake", artist: "Mira Vale" }
      ]
    },
    {
      id: "city-afterglow",
      name: "City Afterglow",
      description: "Imaginary late-night grooves from a made-up city.",
      tracks: [
        { id: "neon-crossing", title: "Neon Crossing", artist: "Velvet Signals" },
        { id: "last-train-home", title: "Last Train Home", artist: "Mono District" },
        { id: "blue-hour-loop", title: "Blue Hour Loop", artist: "Velvet Signals" },
        { id: "rooftop-static", title: "Rooftop Static", artist: "The Night Map" }
      ]
    },
    {
      id: "bright-side",
      name: "The Bright Side",
      description: "Fictional feel-good tracks for a little momentum.",
      tracks: [
        { id: "small-victory", title: "Small Victory", artist: "Sunny Arcade" },
        { id: "open-road", title: "Open Road", artist: "Paper Satellites" },
        { id: "good-company", title: "Good Company", artist: "Sunny Arcade" },
        { id: "golden-minute", title: "Golden Minute", artist: "June Parade" }
      ]
    }
  ];
  const playlistById = new Map(playlists.map((playlist) => [playlist.id, playlist]));
  const playlistIds = playlists.map((playlist) => playlist.id);
  const trackIdsByPlaylist = Object.fromEntries(
    playlists.map((playlist) => [playlist.id, playlist.tracks.map((track) => track.id)])
  );

  function makeDefaultState() {
    return {
      folders: [],
      playlistOrder: playlistIds.slice(),
      assignments: Object.fromEntries(playlistIds.map((id) => [id, null])),
      trackOrders: Object.fromEntries(
        playlists.map((playlist) => [playlist.id, playlist.tracks.map((track) => track.id)])
      )
    };
  }

  function byId(id) {
    return document.getElementById(id);
  }

  let noticeElement = byId("app-notice");
  if (!noticeElement) {
    noticeElement = document.createElement("p");
    noticeElement.id = "app-notice";
    noticeElement.className = "app-notice";
    noticeElement.setAttribute("role", "status");
    noticeElement.setAttribute("aria-live", "polite");
    noticeElement.textContent = "Status area created because #app-notice was missing.";
    const main = byId("main-content");
    (main || document.body).prepend(noticeElement);
    document.dispatchEvent(new CustomEvent("playlist-arranger:notice", {
      detail: { level: "warning", message: "Expected #app-notice was missing; a status area was created." }
    }));
  }

  function setNotice(message, level = "info") {
    noticeElement.textContent = message;
    noticeElement.classList.toggle("is-error", level === "error");
    noticeElement.classList.toggle("is-warning", level === "warning");
    document.dispatchEvent(new CustomEvent("playlist-arranger:notice", {
      detail: { level, message }
    }));
  }

  const elements = {
    folderList: byId("folder-list"),
    playlistList: byId("playlist-list"),
    trackList: byId("track-list"),
    folderForm: byId("folder-form"),
    folderName: byId("folder-name"),
    activeFolder: byId("active-folder"),
    trackPreview: byId("track-preview"),
    commitTrackOrder: byId("commit-track-order"),
    selectedPlaylistName: byId("selected-playlist-name"),
    selectedPlaylistDescription: byId("selected-playlist-description")
  };
  const requiredIds = [
    ["folderList", "#folder-list"],
    ["playlistList", "#playlist-list"],
    ["trackList", "#track-list"],
    ["folderForm", "#folder-form"],
    ["folderName", "#folder-name"],
    ["activeFolder", "#active-folder"],
    ["trackPreview", "#track-preview"],
    ["commitTrackOrder", "#commit-track-order"]
  ];
  const missingRequired = requiredIds
    .filter(([key]) => !elements[key])
    .map(([, id]) => id);

  if (missingRequired.length) {
    setNotice(
      `Required app elements are missing: ${missingRequired.join(", ")}. The arranger could not start.`,
      "error"
    );
    return;
  }

  const missingOptional = [
    ["selected-playlist-name", elements.selectedPlaylistName],
    ["selected-playlist-description", elements.selectedPlaylistDescription]
  ].filter(([, element]) => !element).map(([id]) => `#${id}`);
  if (missingOptional.length) {
    setNotice(`Some optional playlist detail elements are missing: ${missingOptional.join(", ")}.`, "warning");
  }

  const style = document.createElement("style");
  style.textContent = `
    .arranger-row { display: flex; align-items: center; gap: .55rem; padding: .55rem .1rem; border-bottom: 1px solid var(--border); }
    .playlist-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: .45rem .55rem; }
    .playlist-row > .arranger-row-main { grid-column: 1 / -1; }
    .playlist-row > .arranger-select { width: 100%; max-width: none; }
    .arranger-row-main { min-width: 0; flex: 1; }
    .arranger-row-main button { display: block; max-width: 100%; padding: 0; border: 0; color: var(--text); background: transparent; text-align: left; }
    .arranger-row-main button[aria-pressed="true"] { color: var(--accent); }
    .arranger-row-main small { display: block; margin-top: .2rem; color: var(--muted); font-size: .7rem; line-height: 1.4; }
    .arranger-controls { display: flex; gap: .25rem; flex: 0 0 auto; }
    .arranger-button { min-width: 2rem; min-height: 2rem; padding: .25rem .4rem; border: 1px solid var(--control-border); border-radius: 6px; color: var(--text); background: var(--surface-raised); font-family: inherit; }
    .arranger-button:disabled { opacity: .45; cursor: not-allowed; }
    .arranger-select { max-width: 9rem; min-height: 2rem; padding: .25rem; border: 1px solid var(--control-border); border-radius: 6px; color: var(--text); background: var(--control-bg); font-family: inherit; font-size: .7rem; }
    .folder-item { display: flex; align-items: center; gap: .5rem; }
    .folder-item button { overflow-wrap: anywhere; padding: .3rem .45rem; border: 1px solid transparent; border-radius: 6px; color: var(--text); background: transparent; text-align: left; }
    .folder-item button[aria-current="true"] { border-color: var(--accent-border); color: var(--accent); background: var(--accent-wash); }
    .preview-diff { flex: 1 1 100%; width: 100%; padding-top: .65rem; border-top: 1px solid var(--accent-wash-border); }
    .preview-diff h3 { margin: .25rem 0; font-size: .75rem; }
    .preview-diff ol { margin: .2rem 0 .7rem; padding-left: 1.3rem; color: var(--muted); font-size: .72rem; }
    .preview-panel.has-preview { flex-wrap: wrap; }
    .app-notice.is-error { border-left-color: var(--error-text); color: var(--error-text); }
    .app-notice.is-warning { border-left-color: var(--warning); color: var(--warning-status-text); }
  `;
  document.head.append(style);

  let state = makeDefaultState();
  let storage = null;
  let persistenceBlocked = false;
  let selectedFolderId = "all";
  let selectedPlaylistId = null;
  const pendingTrackOrders = new Map();
  let idCounter = 0;

  function isString(value) {
    return typeof value === "string";
  }

  function isPermutation(candidate, expected) {
    return Array.isArray(candidate)
      && candidate.length === expected.length
      && candidate.every((id) => isString(id) && expected.includes(id))
      && new Set(candidate).size === expected.length;
  }

  function validateSavedData(data) {
    if (!data || typeof data !== "object" || data.version !== DATA_VERSION || !data.state) {
      throw new Error("The saved data has an unsupported or missing version.");
    }
    const saved = data.state;
    if (!Array.isArray(saved.folders) || !saved.folders.every((folder) => (
      folder
      && typeof folder === "object"
      && isString(folder.id)
      && folder.id.length > 0
      && isString(folder.name)
      && folder.name.trim().length > 0
      && folder.name.length <= 60
    ))) {
      throw new Error("The saved folder list is invalid.");
    }
    const folderIds = saved.folders.map((folder) => folder.id);
    if (new Set(folderIds).size !== folderIds.length) {
      throw new Error("The saved folder list contains duplicate IDs.");
    }
    if (!isPermutation(saved.playlistOrder, playlistIds)) {
      throw new Error("The saved playlist order is invalid.");
    }
    if (!saved.assignments || typeof saved.assignments !== "object"
      || !playlistIds.every((id) => Object.prototype.hasOwnProperty.call(saved.assignments, id)
        && (saved.assignments[id] === null || folderIds.includes(saved.assignments[id])))) {
      throw new Error("The saved folder assignments are invalid.");
    }
    if (!saved.trackOrders || typeof saved.trackOrders !== "object"
      || !playlists.every((playlist) => isPermutation(
        saved.trackOrders[playlist.id],
        trackIdsByPlaylist[playlist.id]
      ))) {
      throw new Error("The saved track order is invalid.");
    }
    return {
      folders: saved.folders.map((folder) => ({ id: folder.id, name: folder.name })),
      playlistOrder: saved.playlistOrder.slice(),
      assignments: Object.fromEntries(playlistIds.map((id) => [id, saved.assignments[id]])),
      trackOrders: Object.fromEntries(
        playlists.map((playlist) => [playlist.id, saved.trackOrders[playlist.id].slice()])
      )
    };
  }

  try {
    storage = window.localStorage;
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) {
      try {
        state = validateSavedData(JSON.parse(raw));
      } catch (error) {
        persistenceBlocked = true;
        setNotice(
          `Saved demo data could not be read (${error.message}). It has been left untouched; this session is using fresh in-memory demo data and will not overwrite it.`,
          "error"
        );
      }
    }
  } catch (error) {
    storage = null;
    persistenceBlocked = true;
    setNotice(
      `Browser storage is unavailable (${error.message}). The arranger will work for this session only; no saved data was deleted.`,
      "error"
    );
  }

  function persistState() {
    if (!storage || persistenceBlocked) {
      if (!noticeElement.classList.contains("is-error")) {
        setNotice(
          "Changes are available for this session, but browser storage is unavailable or saved data is invalid. Existing data will not be overwritten.",
          "error"
        );
      }
      return false;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, state }));
      return true;
    } catch (error) {
      persistenceBlocked = true;
      setNotice(
        `Could not save to this browser profile (${error.message}). The arranger remains usable for this session; no Spotify data is affected.`,
        "error"
      );
      return false;
    }
  }

  function initializeAppearance() {
    let preferences = { colorMode: "system", colorTheme: "forest", font: "system" };
    let appearanceStorage = null;
    let saveBlockedReason = "";
    const controls = {
      colorMode: byId("color-mode"),
      colorTheme: byId("color-theme"),
      font: byId("font-choice")
    };
    const openButton = byId("open-options");
    const dialog = byId("options-dialog");
    const closeButton = byId("close-options");
    let status = byId("options-status");
    const missing = [
      ["open-options", openButton],
      ["options-dialog", dialog],
      ["close-options", closeButton],
      ["color-mode", controls.colorMode],
      ["color-theme", controls.colorTheme],
      ["font-choice", controls.font],
      ["options-status", status]
    ].filter(([, element]) => !element).map(([id]) => `#${id}`);
    let fallbackStatus = null;
    if (missing.length) {
      fallbackStatus = makeElement("p", "app-notice is-warning");
      fallbackStatus.id = "options-fallback-status";
      fallbackStatus.setAttribute("role", "status");
      fallbackStatus.setAttribute("aria-live", "polite");
      noticeElement.after(fallbackStatus);
      if (!status) status = fallbackStatus;
    }
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");

    function report(message, level = "info") {
      const missingNotice = missing.length
        ? `Options hub unavailable: missing ${missing.join(", ")}. The organizer remains usable. `
        : "";
      status.textContent = missingNotice + message;
      status.classList.toggle("is-error", level === "error");
      status.classList.toggle("is-warning", level === "warning");
      if (fallbackStatus) {
        fallbackStatus.textContent = status.textContent;
      }
      if (level !== "info" || missing.length) {
        setNotice(status.textContent, level === "info" ? "warning" : level);
      }
    }

    function applyPreferences() {
      document.documentElement.dataset.colorMode = preferences.colorMode;
      document.documentElement.dataset.colorTheme = preferences.colorTheme;
      document.documentElement.dataset.font = preferences.font;
      Object.entries(controls).forEach(([key, control]) => {
        if (control) control.value = preferences[key];
      });
    }

    let raw = null;
    try {
      appearanceStorage = window.localStorage;
      raw = appearanceStorage.getItem(APPEARANCE_STORAGE_KEY);
    } catch (error) {
      appearanceStorage = null;
      saveBlockedReason = `Appearance storage is unavailable (${error.message}). Existing settings have been left untouched.`;
    }
    if (raw !== null) {
      try {
        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== "object" || Array.isArray(saved)
          || saved.version !== APPEARANCE_VERSION
          || Object.keys(saved).length !== 4
          || !Object.entries(appearanceChoices).every(([key, choices]) => (
            Object.prototype.hasOwnProperty.call(saved, key) && choices.includes(saved[key])
          ))) {
          throw new Error("Unsupported version or invalid appearance values.");
        }
        preferences = {
          colorMode: saved.colorMode,
          colorTheme: saved.colorTheme,
          font: saved.font
        };
      } catch (error) {
        saveBlockedReason = `Stored appearance settings could not be read (${error.message}). They have been left untouched and will not be overwritten.`;
      }
    }
    applyPreferences();
    report(
      saveBlockedReason
        ? `${saveBlockedReason} Appearance adjustments apply in memory for this session only, not saved in this browser profile.`
        : raw === null
          ? "Using default appearance. Each change will be saved only in this browser profile."
          : "Appearance preferences restored from this browser profile.",
      saveBlockedReason ? "error" : "info"
    );

    if (missing.length) return;
    if (dialog.tagName !== "DIALOG" || typeof dialog.showModal !== "function"
      || typeof dialog.close !== "function") {
      openButton.disabled = true;
      report("This browser cannot open the accessible options dialog. The organizer and current appearance remain usable.", "error");
      return;
    }
    openButton.setAttribute("aria-haspopup", "dialog");
    openButton.setAttribute("aria-controls", "options-dialog");
    openButton.addEventListener("click", () => {
      if (dialog.open) return;
      try {
        dialog.showModal();
        controls.colorMode.focus();
      } catch (error) {
        report(`Could not open appearance options (${error.message}). The organizer remains usable.`, "error");
      }
    });
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      dialog.close();
    });
    // Native dialog cancellation keeps Escape and modal focus containment intact.
    dialog.addEventListener("close", () => openButton.focus());
    Object.entries(controls).forEach(([key, control]) => {
      control.addEventListener("change", () => {
        if (!appearanceChoices[key].includes(control.value)) {
          control.value = preferences[key];
          report("Invalid appearance choice rejected. Existing preferences have not changed.", "error");
          return;
        }
        preferences[key] = control.value;
        applyPreferences();
        if (saveBlockedReason) {
          report(`Appearance applied in memory for this session only; not saved in this browser profile. ${saveBlockedReason}`, "error");
          return;
        }
        try {
          appearanceStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({
            version: APPEARANCE_VERSION,
            ...preferences
          }));
          report("Appearance applied and saved in this browser profile only. No remote fonts or services are used.");
        } catch (error) {
          saveBlockedReason = `Could not save appearance settings (${error.message}). Existing stored settings have been left untouched.`;
          report(`${saveBlockedReason} Appearance applied in memory for this session only; not saved in this browser profile.`, "error");
        }
      });
    });
  }

  function makeElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function makeButton(label, visibleText, className = "arranger-button") {
    const button = makeElement("button", className, visibleText);
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    return button;
  }

  function updateCounts() {
    const folderCount = document.querySelector(".folder-section .section-count");
    if (folderCount) {
      folderCount.textContent = String(state.folders.length);
      folderCount.setAttribute("aria-label", `${state.folders.length} virtual folder${state.folders.length === 1 ? "" : "s"}`);
    }
    const playlistCount = document.querySelector(".library-section .section-count");
    if (playlistCount) {
      playlistCount.textContent = String(playlists.length);
      playlistCount.setAttribute("aria-label", `${playlists.length} fictional demo playlists`);
    }
  }

  function renderFolders() {
    elements.folderList.replaceChildren();
    if (!state.folders.length) {
      elements.folderList.append(makeElement("li", "empty-state", "Your folders will appear here."));
      return;
    }
    state.folders.forEach((folder) => {
      const item = makeElement("li", "folder-item");
      const button = makeButton(`Show playlists in ${folder.name}`, folder.name, "folder-filter-button");
      button.setAttribute("aria-current", String(selectedFolderId === folder.id));
      button.addEventListener("click", () => {
        selectedFolderId = folder.id;
        elements.activeFolder.value = folder.id;
        renderFolders();
        renderPlaylists();
      });
      item.append(button);
      elements.folderList.append(item);
    });
  }

  function renderFolderFilter() {
    const current = state.folders.some((folder) => folder.id === selectedFolderId) ? selectedFolderId : "all";
    selectedFolderId = current;
    elements.activeFolder.replaceChildren();
    const allOption = makeElement("option", "", "All playlists");
    allOption.value = "all";
    elements.activeFolder.append(allOption);
    state.folders.forEach((folder) => {
      const option = makeElement("option", "", folder.name);
      option.value = folder.id;
      elements.activeFolder.append(option);
    });
    elements.activeFolder.value = selectedFolderId;
  }

  function visiblePlaylistIds() {
    return state.playlistOrder.filter((id) => (
      selectedFolderId === "all" || state.assignments[id] === selectedFolderId
    ));
  }

  function movePlaylist(id, direction) {
    const visible = visiblePlaylistIds();
    const visibleIndex = visible.indexOf(id);
    const neighborId = visible[visibleIndex + direction];
    if (!neighborId) return;
    const index = state.playlistOrder.indexOf(id);
    const neighborIndex = state.playlistOrder.indexOf(neighborId);
    [state.playlistOrder[index], state.playlistOrder[neighborIndex]] =
      [state.playlistOrder[neighborIndex], state.playlistOrder[index]];
    const saved = persistState();
    renderPlaylists();
    if (saved) {
      setNotice("Playlist order updated in this local demo only; nothing was written to Spotify.");
    }
  }

  function renderPlaylists() {
    const visible = visiblePlaylistIds();
    elements.playlistList.replaceChildren();
    if (!visible.length) {
      elements.playlistList.append(makeElement(
        "li",
        "empty-state playlist-empty",
        selectedFolderId === "all"
          ? "No demo playlists are available."
          : "No playlists are assigned to this folder yet."
      ));
      return;
    }
    visible.forEach((id, visibleIndex) => {
      const playlist = playlistById.get(id);
      const item = makeElement("li", "arranger-row playlist-row");
      const main = makeElement("div", "arranger-row-main");
      const selectButton = makeElement("button", "", playlist.name);
      selectButton.type = "button";
      selectButton.setAttribute("aria-pressed", String(selectedPlaylistId === id));
      selectButton.setAttribute("aria-label", `Select playlist ${playlist.name}`);
      selectButton.addEventListener("click", () => selectPlaylist(id));
      const description = makeElement("small", "", playlist.description);
      main.append(selectButton, description);

      const folderSelect = makeElement("select", "arranger-select");
      folderSelect.setAttribute("aria-label", `Folder for ${playlist.name}`);
      const unassigned = makeElement("option", "", "No folder");
      unassigned.value = "";
      folderSelect.append(unassigned);
      state.folders.forEach((folder) => {
        const option = makeElement("option", "", folder.name);
        option.value = folder.id;
        folderSelect.append(option);
      });
      folderSelect.value = state.assignments[id] || "";
      folderSelect.addEventListener("change", () => {
        state.assignments[id] = folderSelect.value || null;
        const saved = persistState();
        renderFolders();
        renderPlaylists();
        if (saved) {
          setNotice(
            state.assignments[id]
              ? `${playlist.name} assigned to a virtual folder in this local demo.`
              : `${playlist.name} removed from its virtual folder in this local demo.`
          );
        }
      });

      const controls = makeElement("div", "arranger-controls");
      const up = makeButton(`Move ${playlist.name} up`, "↑");
      up.disabled = visibleIndex === 0;
      up.addEventListener("click", () => movePlaylist(id, -1));
      const down = makeButton(`Move ${playlist.name} down`, "↓");
      down.disabled = visibleIndex === visible.length - 1;
      down.addEventListener("click", () => movePlaylist(id, 1));
      controls.append(up, down);
      item.append(main, folderSelect, controls);
      elements.playlistList.append(item);
    });
  }

  function trackTitle(playlistId, trackId) {
    const track = playlistById.get(playlistId).tracks.find((item) => item.id === trackId);
    return track ? `${track.title} — ${track.artist}` : trackId;
  }

  let previewHeading = null;
  let previewDescription = null;
  let previewDiff = null;
  let cancelPreviewButton = null;

  function createPreviewControls() {
    previewHeading = elements.trackPreview.querySelector("#preview-heading");
    previewDescription = elements.trackPreview.querySelector(".preview-copy p");
    if (!previewHeading) {
      setNotice("Expected preview heading #preview-heading is missing; the preview can still be confirmed or discarded.", "warning");
      previewHeading = makeElement("h2", "", "Order preview");
      previewHeading.id = "preview-heading";
      elements.trackPreview.prepend(previewHeading);
    }
    if (!previewDescription) {
      setNotice("Expected preview description is missing; a fallback preview description was added.", "warning");
      previewDescription = makeElement("p", "", "Any proposed track reorder appears here before confirmation.");
      (previewHeading.parentElement || elements.trackPreview).append(previewDescription);
    }
    previewDiff = makeElement("div", "preview-diff");
    previewDiff.setAttribute("aria-live", "polite");
    previewDiff.setAttribute("aria-label", "Before and after track order");
    previewDiff.hidden = true;
    elements.trackPreview.insertBefore(previewDiff, elements.commitTrackOrder);

    cancelPreviewButton = makeButton("Discard unconfirmed track order", "Discard preview", "arranger-button");
    cancelPreviewButton.addEventListener("click", discardTrackPreview);
    cancelPreviewButton.hidden = true;
    elements.trackPreview.insertBefore(cancelPreviewButton, elements.commitTrackOrder.nextSibling);
    elements.commitTrackOrder.disabled = true;
    elements.commitTrackOrder.addEventListener("click", confirmTrackOrder);
  }

  function getDisplayedTrackOrder(playlistId) {
    return pendingTrackOrders.get(playlistId) || state.trackOrders[playlistId];
  }

  function renderPreview() {
    const pending = selectedPlaylistId && pendingTrackOrders.get(selectedPlaylistId);
    const hasPending = Boolean(pending);
    elements.trackPreview.classList.toggle("has-preview", hasPending);
    elements.commitTrackOrder.disabled = !hasPending;
    cancelPreviewButton.hidden = !hasPending;
    previewDiff.hidden = !hasPending;
    if (!selectedPlaylistId) {
      previewDescription.textContent = "Choose a playlist to arrange its fictional sample tracks. Nothing is sent to Spotify.";
      previewDiff.replaceChildren();
      return;
    }
    if (!hasPending) {
      previewDescription.textContent = "No unconfirmed changes. Reorder tracks above to preview before committing to local demo storage.";
      previewDiff.replaceChildren();
      return;
    }
    previewDescription.textContent = "Review the current order and proposed order. Confirm to save this change only in local demo storage.";
    previewDiff.replaceChildren();
    const beforeHeading = makeElement("h3", "", "Before");
    const beforeList = makeElement("ol", "preview-order");
    state.trackOrders[selectedPlaylistId].forEach((trackId) => {
      beforeList.append(makeElement("li", "", trackTitle(selectedPlaylistId, trackId)));
    });
    const afterHeading = makeElement("h3", "", "After");
    const afterList = makeElement("ol", "preview-order");
    pending.forEach((trackId) => {
      afterList.append(makeElement("li", "", trackTitle(selectedPlaylistId, trackId)));
    });
    previewDiff.append(beforeHeading, beforeList, afterHeading, afterList);
  }

  function renderTracks() {
    elements.trackList.replaceChildren();
    if (!selectedPlaylistId) {
      elements.trackList.append(makeElement("li", "empty-state track-empty", "Choose a playlist to see its tracks."));
      renderPreview();
      return;
    }
    const playlist = playlistById.get(selectedPlaylistId);
    if (elements.selectedPlaylistName) {
      elements.selectedPlaylistName.textContent = playlist.name;
    }
    if (elements.selectedPlaylistDescription) {
      elements.selectedPlaylistDescription.textContent =
        `${playlist.description} Fictional sample data; changes stay in this browser profile and are not written to Spotify.`;
    }
    const order = getDisplayedTrackOrder(selectedPlaylistId);
    order.forEach((trackId, index) => {
      const track = playlist.tracks.find((item) => item.id === trackId);
      const item = makeElement("li", "arranger-row track-row");
      const main = makeElement("div", "arranger-row-main");
      main.append(
        makeElement("span", "", track ? track.title : trackId),
        makeElement("small", "", track ? track.artist : "")
      );
      const controls = makeElement("div", "arranger-controls");
      const up = makeButton(`Move ${track ? track.title : trackId} up`, "↑");
      up.disabled = index === 0;
      up.addEventListener("click", () => moveTrack(index, -1));
      const down = makeButton(`Move ${track ? track.title : trackId} down`, "↓");
      down.disabled = index === order.length - 1;
      down.addEventListener("click", () => moveTrack(index, 1));
      controls.append(up, down);
      item.append(main, controls);
      elements.trackList.append(item);
    });
    renderPreview();
  }

  function selectPlaylist(id) {
    selectedPlaylistId = id;
    renderPlaylists();
    renderTracks();
    setNotice(`${playlistById.get(id).name} selected. Reorder its fictional sample tracks to prepare a local-only preview.`);
  }

  function moveTrack(index, direction) {
    if (!selectedPlaylistId) return;
    const current = getDisplayedTrackOrder(selectedPlaylistId).slice();
    const destination = index + direction;
    if (destination < 0 || destination >= current.length) return;
    [current[index], current[destination]] = [current[destination], current[index]];
    pendingTrackOrders.set(selectedPlaylistId, current);
    renderTracks();
  }

  function discardTrackPreview() {
    if (!selectedPlaylistId || !pendingTrackOrders.has(selectedPlaylistId)) return;
    pendingTrackOrders.delete(selectedPlaylistId);
    renderTracks();
    setNotice("Unconfirmed track changes discarded. The displayed order is restored to the committed local demo order.");
  }

  function confirmTrackOrder() {
    if (!selectedPlaylistId || !pendingTrackOrders.has(selectedPlaylistId)) return;
    const proposed = pendingTrackOrders.get(selectedPlaylistId);
    const committed = state.trackOrders[selectedPlaylistId];
    if (proposed.length !== committed.length || proposed.every((id, index) => id === committed[index])) {
      pendingTrackOrders.delete(selectedPlaylistId);
      renderTracks();
      setNotice("There is no track-order change to commit.");
      return;
    }
    const playlistName = playlistById.get(selectedPlaylistId).name;
    state.trackOrders[selectedPlaylistId] = proposed.slice();
    pendingTrackOrders.delete(selectedPlaylistId);
    const saved = persistState();
    renderTracks();
    if (saved) {
      setNotice(`Track order confirmed for ${playlistName} in this browser's local demo storage only. It was not written to Spotify.`);
    }
  }

  function createFolder(name) {
    let value;
    try {
      value = name.trim();
    } catch (error) {
      setNotice(`The folder name could not be read (${error.message}).`, "error");
      return;
    }
    if (!value) {
      setNotice("Enter a folder name before creating a virtual folder.", "warning");
      elements.folderName.focus();
      return;
    }
    if (value.length > 60) {
      setNotice("Folder names must be 60 characters or fewer.", "warning");
      elements.folderName.focus();
      return;
    }
    if (state.folders.some((folder) => folder.name.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setNotice("A virtual folder with that name already exists.", "warning");
      elements.folderName.focus();
      return;
    }
    idCounter += 1;
    const id = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `folder-${Date.now()}-${idCounter}`;
    state.folders.push({ id, name: value });
    selectedFolderId = id;
    elements.folderName.value = "";
    renderFolderFilter();
    renderFolders();
    renderPlaylists();
    updateCounts();
    const saved = persistState();
    if (saved) {
      setNotice(`Virtual folder "${value}" created in this local demo. It does not change Spotify's Library.`);
    }
  }

  elements.folderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createFolder(elements.folderName.value);
  });
  elements.activeFolder.addEventListener("change", () => {
    selectedFolderId = elements.activeFolder.value || "all";
    renderFolders();
    renderPlaylists();
  });

  function render() {
    renderFolderFilter();
    renderFolders();
    renderPlaylists();
    updateCounts();
    renderTracks();
  }

  createPreviewControls();
  render();
  initializeAppearance();
  if (!noticeElement.classList.contains("is-error") && !noticeElement.classList.contains("is-warning")) {
    setNotice("Demo only: fictional sample playlists. Folders and confirmed order stay in this device/browser profile and are never written to Spotify.");
  }

  if (!window.isSecureContext) {
    if (!noticeElement.classList.contains("is-error") && !noticeElement.classList.contains("is-warning")) {
      setNotice("Service worker registration skipped because this page is not in a secure context. The local demo remains usable; no Spotify connection is made.", "warning");
    }
  } else if (!("serviceWorker" in navigator)) {
    if (!noticeElement.classList.contains("is-error") && !noticeElement.classList.contains("is-warning")) {
      setNotice("This browser does not support service workers. The local demo remains usable; no Spotify connection is made.", "warning");
    }
  } else {
    navigator.serviceWorker.register("./sw.js")
      .then(() => {
        if (!noticeElement.classList.contains("is-error") && !noticeElement.classList.contains("is-warning")) {
          setNotice("Demo ready. Service worker registered; all folders and confirmed ordering remain local and are never written to Spotify.");
        }
      })
      .catch((error) => {
        if (!noticeElement.classList.contains("is-error")) {
          setNotice(
            `Service worker registration failed (${error.message}). The local demo is still usable; no Spotify connection or write was attempted.`,
            "warning"
          );
        }
      });
  }
})();
