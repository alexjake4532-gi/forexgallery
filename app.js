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
const entryForm = document.querySelector("#entryForm");
const entryMessage = document.querySelector("#entryMessage");
const entriesGrid = document.querySelector("#entriesGrid");
const refreshButton = document.querySelector("#refreshButton");
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
  document.body.style.overflow = "";
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

async function loadEntries() {
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
    entriesGrid.innerHTML = '<p class="message">No entries yet. Save your first setup.</p>';
    return;
  }

  const cards = await Promise.all(
    data.map(async (entry) => {
      const imageUrl = await getSignedImageUrl(entry.image_path);
      const createdAt = new Date(entry.created_at).toLocaleString();
      const prices = [
        entry.entry_price ? `Entry ${entry.entry_price}` : "",
        entry.stop_loss ? `SL ${entry.stop_loss}` : "",
        entry.take_profit ? `TP ${entry.take_profit}` : "",
      ].filter(Boolean).join(" | ");

      return `
        <article class="entry-card">
          ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(entry.pair)} trade screenshot" data-viewer-src="${imageUrl}" data-viewer-title="${escapeHtml(entry.pair)} ${escapeHtml(entry.direction)}" />` : ""}
          <div class="entry-content">
            <div class="entry-meta">
              <span class="pair">${escapeHtml(entry.pair)}</span>
              <span class="direction ${escapeHtml(entry.direction)}">${escapeHtml(entry.direction)}</span>
            </div>
            ${prices ? `<p class="prices">${escapeHtml(prices)}</p>` : ""}
            ${entry.notes ? `<p class="notes">${escapeHtml(entry.notes)}</p>` : ""}
            <p class="date">${escapeHtml(createdAt)}</p>
          </div>
        </article>
      `;
    })
  );

  entriesGrid.innerHTML = cards.join("");
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

refreshButton.addEventListener("click", loadEntries);

entriesGrid.addEventListener("click", (event) => {
  const image = event.target.closest("[data-viewer-src]");

  if (!image) {
    return;
  }

  openImageViewer(image.dataset.viewerSrc, image.dataset.viewerTitle || "Trade entry");
});

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

imageViewer.addEventListener("click", (event) => {
  if (event.target === imageViewer) {
    closeImageViewer();
  }
});

document.addEventListener("keydown", (event) => {
  if (imageViewer.classList.contains("hidden")) {
    return;
  }

  if (event.key === "Escape") {
    closeImageViewer();
    toggleSettings(false);
  }
});

applyTheme(localStorage.getItem("forex-journal-theme") || "dark");

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    setMessage(entryMessage, "Please sign in first.", true);
    return;
  }

  const imageFile = document.querySelector("#imageInput").files[0];
  if (!imageFile) {
    setMessage(entryMessage, "Choose a screenshot first.", true);
    return;
  }

  const saveButton = document.querySelector("#saveEntryButton");
  saveButton.disabled = true;
  setMessage(entryMessage, "Uploading screenshot...");

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

  setMessage(entryMessage, "Saving entry...");

  const { error: insertError } = await supabaseClient.from("trade_entries").insert({
    user_id: currentUser.id,
    pair: document.querySelector("#pairInput").value.trim().toUpperCase(),
    direction: document.querySelector("#directionInput").value,
    entry_price: numberOrNull(document.querySelector("#entryPriceInput").value),
    stop_loss: numberOrNull(document.querySelector("#stopLossInput").value),
    take_profit: numberOrNull(document.querySelector("#takeProfitInput").value),
    notes: document.querySelector("#notesInput").value.trim() || null,
    image_path: filePath,
  });

  saveButton.disabled = false;

  if (insertError) {
    setMessage(entryMessage, insertError.message, true);
    return;
  }

  entryForm.reset();
  setMessage(entryMessage, "Entry saved.");
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
