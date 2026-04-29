const supabaseUrl = "https://agydsulqmenpomtuxhlm.supabase.co";
const supabaseKey = "sb_publishable_xQ5ve6oE-anJVUSbpwIKbA_ZgTSyRAJ";
const tradeBucket = "trade-entry-images";

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const authView = document.querySelector("#authView");
const journalView = document.querySelector("#journalView");
const authForm = document.querySelector("#authForm");
const authTitle = document.querySelector("#authTitle");
const authSubmit = document.querySelector("#authSubmit");
const toggleAuth = document.querySelector("#toggleAuth");
const authMessage = document.querySelector("#authMessage");
const emailInput = document.querySelector("#emailInput");
const passwordInput = document.querySelector("#passwordInput");
const signOutButton = document.querySelector("#signOutButton");
const openEntryFormButton = document.querySelector("#openEntryFormButton");
const closeEntryFormButton = document.querySelector("#closeEntryFormButton");
const entryFormPanel = document.querySelector("#entryFormPanel");
const entryForm = document.querySelector("#entryForm");
const entryMessage = document.querySelector("#entryMessage");
const entriesMessage = document.querySelector("#entriesMessage");
const entriesGrid = document.querySelector("#entriesGrid");
const refreshButton = document.querySelector("#refreshButton");
const entryDetailPanel = document.querySelector("#entryDetailPanel");
const closeDetailButton = document.querySelector("#closeDetailButton");
const detailTitle = document.querySelector("#detailTitle");
const detailStats = document.querySelector("#detailStats");
const detailNotes = document.querySelector("#detailNotes");
const detailImages = document.querySelector("#detailImages");
const imageViewer = document.querySelector("#imageViewer");
const viewerImage = document.querySelector("#viewerImage");
const viewerTitle = document.querySelector("#viewerTitle");
const zoomOutButton = document.querySelector("#zoomOutButton");
const zoomResetButton = document.querySelector("#zoomResetButton");
const zoomInButton = document.querySelector("#zoomInButton");
const closeViewerButton = document.querySelector("#closeViewerButton");
const settingsButton = document.querySelector("#settingsButton");
const settingsPanel = document.querySelector("#settingsPanel");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const themeOptionButtons = document.querySelectorAll("[data-theme-option]");

let isSignUp = false;
let currentUser = null;
let viewerZoom = 1;
let entryCache = new Map();

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("forex-journal-theme", theme);

  themeOptionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.themeOption === theme);
  });
}

function toggleSettings(show) {
  const shouldShow = show ?? settingsPanel.classList.contains("hidden");
  settingsPanel.classList.toggle("hidden", !shouldShow);
  settingsPanel.setAttribute("aria-hidden", String(!shouldShow));
}

function toggleEntryForm(show) {
  const shouldShow = show ?? entryFormPanel.classList.contains("hidden");
  entryFormPanel.classList.toggle("hidden", !shouldShow);
  entryFormPanel.setAttribute("aria-hidden", String(!shouldShow));
  document.body.style.overflow = shouldShow ? "hidden" : "";
}

function toggleEntryDetail(show) {
  const shouldShow = show ?? entryDetailPanel.classList.contains("hidden");
  entryDetailPanel.classList.toggle("hidden", !shouldShow);
  entryDetailPanel.setAttribute("aria-hidden", String(!shouldShow));
  document.body.style.overflow = shouldShow ? "hidden" : "";
}

function setMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("error", isError);
}

function setAuthMode(nextIsSignUp) {
  isSignUp = nextIsSignUp;
  authTitle.textContent = isSignUp ? "Create account" : "Sign in";
  authSubmit.textContent = isSignUp ? "Create account" : "Sign in";
  toggleAuth.textContent = isSignUp ? "Already have an account?" : "Create account";
  setMessage(authMessage, "");
}

function showJournal(user) {
  currentUser = user;
  authView.classList.add("hidden");
  journalView.classList.remove("hidden");
  loadEntries();
}

function showAuth() {
  currentUser = null;
  journalView.classList.add("hidden");
  authView.classList.remove("hidden");
}

function numberOrNull(value) {
  return value === "" ? null : Number(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function getEntryImagePaths(entry) {
  if (Array.isArray(entry.image_paths) && entry.image_paths.length) {
    return entry.image_paths;
  }

  return entry.image_path ? [entry.image_path] : [];
}

function updateViewerZoom() {
  viewerImage.style.width = `${Math.round(viewerZoom * 100)}%`;
}

function openImageViewer(imageUrl, title) {
  viewerZoom = 1;
  viewerImage.src = imageUrl;
  viewerTitle.textContent = title;
  updateViewerZoom();
  imageViewer.classList.remove("hidden");
  imageViewer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeImageViewer() {
  imageViewer.classList.add("hidden");
  imageViewer.setAttribute("aria-hidden", "true");
  viewerImage.removeAttribute("src");
  document.body.style.overflow = entryDetailPanel.classList.contains("hidden") ? "" : "hidden";
}

function changeViewerZoom(amount) {
  viewerZoom = Math.min(3, Math.max(0.5, viewerZoom + amount));
  updateViewerZoom();
}

async function getSignedImageUrl(path) {
  const { data, error } = await supabaseClient.storage
    .from(tradeBucket)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    return "";
  }

  return data.signedUrl;
}

async function hydrateEntryImages(entry) {
  const paths = getEntryImagePaths(entry);
  const images = await Promise.all(
    paths.map(async (path) => ({
      path,
      url: await getSignedImageUrl(path),
    }))
  );

  return {
    ...entry,
    images: images.filter((image) => image.url),
  };
}

function statMarkup(label, value) {
  return `
    <div class="stat-pill">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value ?? "-")}</strong>
    </div>
  `;
}

function renderEntryDetail(entryId) {
  const entry = entryCache.get(entryId);

  if (!entry) {
    return;
  }

  detailTitle.textContent = `${entry.pair} ${entry.direction}`;
  detailStats.innerHTML = [
    statMarkup("Direction", entry.direction),
    statMarkup("Entry", entry.entry_price),
    statMarkup("Stop loss", entry.stop_loss),
    statMarkup("Take profit", entry.take_profit),
    statMarkup("Created", new Date(entry.created_at).toLocaleString()),
  ].join("");
  detailNotes.textContent = entry.notes || "No notes saved.";
  detailImages.innerHTML = entry.images.length
    ? entry.images.map((image, index) => `
        <button type="button" class="detail-image-button" data-fullscreen-src="${image.url}" data-fullscreen-title="${escapeHtml(entry.pair)} screenshot ${index + 1}">
          <img src="${image.url}" alt="${escapeHtml(entry.pair)} screenshot ${index + 1}" />
        </button>
      `).join("")
    : '<p class="message">No screenshots saved for this entry.</p>';

  toggleEntryDetail(true);
}

async function deleteEntry(entryId) {
  const entry = entryCache.get(entryId);
  const confirmed = window.confirm(`Delete ${entry?.pair || "this entry"}? This removes the entry and all screenshots.`);

  if (!confirmed) {
    return;
  }

  setMessage(entriesMessage, "Deleting entry...");

  const { error: rowError } = await supabaseClient
    .from("trade_entries")
    .delete()
    .eq("id", entryId);

  if (rowError) {
    setMessage(entriesMessage, rowError.message, true);
    return;
  }

  const paths = entry ? getEntryImagePaths(entry) : [];
  if (paths.length) {
    const { error: storageError } = await supabaseClient.storage
      .from(tradeBucket)
      .remove(paths);

    if (storageError) {
      setMessage(entriesMessage, `Entry deleted, but screenshot cleanup failed: ${storageError.message}`, true);
      loadEntries();
      return;
    }
  }

  setMessage(entriesMessage, "Entry deleted.");
  toggleEntryDetail(false);
  loadEntries();
}

async function loadEntries() {
  setMessage(entriesMessage, "");
  entriesGrid.innerHTML = '<p class="message">Loading entries...</p>';

  const { data, error } = await supabaseClient
    .from("trade_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    entriesGrid.innerHTML = `<p class="message error">${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data.length) {
    entryCache = new Map();
    entriesGrid.innerHTML = '<p class="message">No entries yet. Tap + to save your first setup.</p>';
    return;
  }

  const hydratedEntries = await Promise.all(data.map(hydrateEntryImages));
  entryCache = new Map(hydratedEntries.map((entry) => [entry.id, entry]));

  entriesGrid.innerHTML = hydratedEntries.map((entry) => {
    const coverImage = entry.images[0]?.url || "";
    const createdAt = new Date(entry.created_at).toLocaleString();
    const prices = [
      entry.entry_price ? `Entry ${entry.entry_price}` : "",
      entry.stop_loss ? `SL ${entry.stop_loss}` : "",
      entry.take_profit ? `TP ${entry.take_profit}` : "",
    ].filter(Boolean).join(" | ");

    return `
      <article class="entry-card">
        ${coverImage ? `<img src="${coverImage}" alt="${escapeHtml(entry.pair)} trade screenshot" />` : ""}
        <div class="entry-content">
          <div class="entry-meta">
            <span class="pair">${escapeHtml(entry.pair)}</span>
            <span class="direction ${escapeHtml(entry.direction)}">${escapeHtml(entry.direction)}</span>
          </div>
          ${prices ? `<p class="prices">${escapeHtml(prices)}</p>` : ""}
          ${entry.notes ? `<p class="notes">${escapeHtml(entry.notes)}</p>` : ""}
          <p class="date">${escapeHtml(createdAt)} | ${entry.images.length} screenshot${entry.images.length === 1 ? "" : "s"}</p>
          <div class="entry-actions">
            <button type="button" class="ghost-button" data-view-entry-id="${escapeHtml(entry.id)}">View</button>
            <button type="button" class="danger-button" data-delete-entry-id="${escapeHtml(entry.id)}">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

toggleAuth.addEventListener("click", () => {
  setAuthMode(!isSignUp);
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authSubmit.disabled = true;
  setMessage(authMessage, isSignUp ? "Creating account..." : "Signing in...");

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const authAction = isSignUp
    ? supabaseClient.auth.signUp({ email, password })
    : supabaseClient.auth.signInWithPassword({ email, password });

  const { data, error } = await authAction;
  authSubmit.disabled = false;

  if (error) {
    setMessage(authMessage, error.message, true);
    return;
  }

  if (isSignUp && !data.session) {
    setMessage(authMessage, "Check your email to confirm your account, then sign in.");
    return;
  }

  setMessage(authMessage, "");
});

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showAuth();
});

openEntryFormButton.addEventListener("click", () => toggleEntryForm(true));
closeEntryFormButton.addEventListener("click", () => toggleEntryForm(false));
refreshButton.addEventListener("click", loadEntries);

entriesGrid.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-entry-id]");

  if (deleteButton) {
    deleteEntry(deleteButton.dataset.deleteEntryId);
    return;
  }

  const viewButton = event.target.closest("[data-view-entry-id]");

  if (viewButton) {
    renderEntryDetail(viewButton.dataset.viewEntryId);
  }
});

detailImages.addEventListener("click", (event) => {
  const imageButton = event.target.closest("[data-fullscreen-src]");

  if (!imageButton) {
    return;
  }

  openImageViewer(imageButton.dataset.fullscreenSrc, imageButton.dataset.fullscreenTitle || "Trade screenshot");
});

closeDetailButton.addEventListener("click", () => toggleEntryDetail(false));
zoomOutButton.addEventListener("click", () => changeViewerZoom(-0.25));
zoomInButton.addEventListener("click", () => changeViewerZoom(0.25));
zoomResetButton.addEventListener("click", () => {
  viewerZoom = 1;
  updateViewerZoom();
});
closeViewerButton.addEventListener("click", closeImageViewer);
settingsButton.addEventListener("click", () => toggleSettings());
closeSettingsButton.addEventListener("click", () => toggleSettings(false));

themeOptionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeOption);
  });
});

entryFormPanel.addEventListener("click", (event) => {
  if (event.target === entryFormPanel) {
    toggleEntryForm(false);
  }
});

entryDetailPanel.addEventListener("click", (event) => {
  if (event.target === entryDetailPanel) {
    toggleEntryDetail(false);
  }
});

imageViewer.addEventListener("click", (event) => {
  if (event.target === imageViewer) {
    closeImageViewer();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (!imageViewer.classList.contains("hidden")) {
    closeImageViewer();
    return;
  }

  toggleEntryDetail(false);
  toggleEntryForm(false);
  toggleSettings(false);
});

applyTheme(localStorage.getItem("forex-journal-theme") || "dark");

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    setMessage(entryMessage, "Please sign in first.", true);
    return;
  }

  const imageFiles = Array.from(document.querySelector("#imageInput").files);
  if (!imageFiles.length) {
    setMessage(entryMessage, "Choose at least one screenshot first.", true);
    return;
  }

  const saveButton = document.querySelector("#saveEntryButton");
  saveButton.disabled = true;
  setMessage(entryMessage, "Uploading screenshots...");

  const uploadedPaths = [];
  for (const imageFile of imageFiles) {
    const extension = imageFile.name.split(".").pop() || "png";
    const filePath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseClient.storage
      .from(tradeBucket)
      .upload(filePath, imageFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      saveButton.disabled = false;
      setMessage(entryMessage, uploadError.message, true);
      return;
    }

    uploadedPaths.push(filePath);
  }

  setMessage(entryMessage, "Saving entry...");

  const entryPayload = {
    user_id: currentUser.id,
    pair: document.querySelector("#pairInput").value.trim().toUpperCase(),
    direction: document.querySelector("#directionInput").value,
    entry_price: numberOrNull(document.querySelector("#entryPriceInput").value),
    stop_loss: numberOrNull(document.querySelector("#stopLossInput").value),
    take_profit: numberOrNull(document.querySelector("#takeProfitInput").value),
    notes: document.querySelector("#notesInput").value.trim() || null,
    image_path: uploadedPaths[0],
    image_paths: uploadedPaths,
  };

  const { error: insertError } = await supabaseClient.from("trade_entries").insert(entryPayload);

  saveButton.disabled = false;

  if (insertError) {
    setMessage(entryMessage, insertError.message, true);
    return;
  }

  entryForm.reset();
  setMessage(entryMessage, "Entry saved.");
  toggleEntryForm(false);
  loadEntries();
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    showJournal(session.user);
  } else {
    showAuth();
  }
});

supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session?.user) {
    showJournal(data.session.user);
  } else {
    showAuth();
  }
});
