/* ==========================================================================
   INVENZA — Utilities (English Standard)
   Helper functions shared across the application:
   toast notifications, currency & date formatting, stock status, modals, etc.
   ========================================================================== */

/* ---------- Toast Notification ---------- */
function ensureToastContainer() {
  let el = document.getElementById("toast-container");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-container";
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message, type = "success", duration = 3500) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const iconClass =
    type === "success" ? "bi-check-circle-fill" : type === "error" ? "bi-x-circle-fill" : "bi-info-circle-fill";
  toast.innerHTML = `<span><i class="bi ${iconClass}"></i></span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px) scale(0.96)";
    toast.style.transition = "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/* ---------- Escaping (XSS Safety) ---------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------- Formatting ---------- */
function formatRupiah(value) {
  const num = Number(value) || 0;
  return "Rp " + num.toLocaleString("en-US");
}
const formatCurrency = formatRupiah;

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- Stock Status ---------- */
function getStockStatus(stock) {
  const s = Number(stock);
  if (s === 0) return { label: "Out of Stock", cls: "badge-danger", key: "out_of_stock" };
  if (s <= LOW_STOCK_THRESHOLD) return { label: "Low Stock", cls: "badge-warning", key: "low_stock" };
  return { label: "In Stock", cls: "badge-success", key: "in_stock" };
}

/* ---------- Button Loading State ---------- */
function setButtonLoading(btn, isLoading, loadingText = "Processing...") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${escapeHtml(loadingText)}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
  }
}

/* ---------- Error Translation (English) ---------- */
function translateError(err) {
  const msg = (err && err.message) ? err.message : String(err || "");
  const lower = msg.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Email has not been verified. Please check your inbox.";
  }
  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "This email is already registered. Please sign in.";
  }
  if (lower.includes("duplicate key") && lower.includes("code")) {
    return "Product code is already in use.";
  }
  if (lower.includes("duplicate key")) {
    return "Duplicate data record already exists.";
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "Access denied. You do not have permission for this action.";
  }
  if (lower.includes("violates check constraint") || lower.includes("violates foreign key")) {
    return "Invalid data provided. Please verify all fields.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed")) {
    return "Network connection issue. Operating in offline/cached mode.";
  }
  if (lower.includes("jwt") || lower.includes("session")) {
    return "Your session has expired. Please sign in again.";
  }
  if (msg) return msg;
  return "An unexpected error occurred. Please try again.";
}

/* ---------- Confirmation Dialog (Promise based) ---------- */
function confirmDialog({ title = "Confirm Action", message = "Are you sure you want to proceed?", confirmText = "Confirm", cancelText = "Cancel", danger = true }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box modal-sm">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">
          <p style="margin:0; color:var(--color-text-muted); font-size:14px; line-height:1.5;">${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-action="confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    function cleanup(result) {
      overlay.remove();
      resolve(result);
    }
    overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => cleanup(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener("click", () => cleanup(true));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

/* ---------- Password Show/Hide Toggle ---------- */
function initPasswordToggles(root = document) {
  root.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;
      const icon = btn.querySelector("i");
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      if (icon) {
        icon.classList.toggle("bi-eye", !isHidden);
        icon.classList.toggle("bi-eye-slash", isHidden);
      }
    });
  });
}

/* ---------- Query Param Helper ---------- */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/* ---------- Unique Filename for Storage Uploads ---------- */
function buildUniqueFileName(originalName) {
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "jpg";
  const base = originalName.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  const rand = Math.random().toString(36).slice(2, 9);
  return `${base || "product"}-${Date.now()}-${rand}.${ext}`;
}

/* ---------- Safe Image Extension Helper ---------- */
function getSafeImageExtension(file) {
  const allowed = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };
  return allowed[(file && file.type || "").toLowerCase()] || null;
}

/* ---------- Username Validation ---------- */
function validateUsername(raw) {
  const value = (raw || "").trim();
  if (!value) return { valid: false, message: "Username is required." };
  if (/\s/.test(value)) return { valid: false, message: "Username cannot contain spaces." };
  if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) {
    return { valid: false, message: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.` };
  }
  if (!/^[a-zA-Z0-9_.]+$/.test(value)) {
    return { valid: false, message: "Username can only contain letters, numbers, dots, and underscores." };
  }
  return { valid: true, value };
}

/* ---------- Avatar File Validation ---------- */
function validateAvatarFile(file) {
  if (!file) return { valid: false, message: "Please select an image file." };
  const ext = getSafeImageExtension(file);
  if (!ext) return { valid: false, message: "Unsupported image format. Please use JPG, PNG, or WebP." };
  if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
    return { valid: false, message: `Image file is too large. Maximum size is ${MAX_AVATAR_SIZE_MB}MB.` };
  }
  return { valid: true, ext };
}

/* ---------- NexByte Game Store — Categories, Units & Code Generation ---------- */

/**
 * Predefined store categories with standard short code prefixes.
 * Designed for NexByte Game Store (PC components, gaming gear, games, consoles).
 */
const STORE_CATEGORIES = [
  // --- PC Components ---
  { value: "CPU",            prefix: "CPU", label: "CPU / Processor",                group: "PC Components" },
  { value: "GPU",            prefix: "GPU", label: "GPU / Graphics Card",            group: "PC Components" },
  { value: "RAM",            prefix: "RAM", label: "RAM / Memory",                   group: "PC Components" },
  { value: "Motherboard",    prefix: "MB",  label: "Motherboard",                    group: "PC Components" },
  { value: "Power Supply",   prefix: "PSU", label: "Power Supply (PSU)",             group: "PC Components" },
  { value: "Storage SSD",    prefix: "SSD", label: "Storage SSD / NVMe",             group: "PC Components" },
  { value: "Storage HDD",    prefix: "HDD", label: "Storage Hard Disk",              group: "PC Components" },
  { value: "PC Case",        prefix: "CSE", label: "PC Case / Casing",               group: "PC Components" },
  { value: "Cooling / Fan",  prefix: "CLR", label: "Cooler & Fan",                   group: "PC Components" },

  // --- Peripherals & Gear ---
  { value: "Keyboard",       prefix: "KB",  label: "Keyboard",                       group: "Peripherals" },
  { value: "Mouse",          prefix: "MS",  label: "Mouse",                          group: "Peripherals" },
  { value: "Headset",        prefix: "HS",  label: "Headset & Earphone",             group: "Peripherals" },
  { value: "Monitor",        prefix: "MON", label: "Monitor & Display",              group: "Peripherals" },
  { value: "Mousepad",       prefix: "MP",  label: "Mousepad & Desk Mat",            group: "Peripherals" },
  { value: "Controller",     prefix: "CTR", label: "Controller & Gamepad",           group: "Peripherals" },
  { value: "Microphone",     prefix: "MIC", label: "Microphone",                     group: "Peripherals" },
  { value: "Webcam",         prefix: "CAM", label: "Webcam & Camera",                group: "Peripherals" },
  { value: "Speaker",        prefix: "SPK", label: "Gaming Speaker",                 group: "Peripherals" },

  // --- Games (Digital & Physical) ---
  { value: "Game PC",        prefix: "GPC", label: "Game PC (Steam / Epic / GOG)",   group: "Games" },
  { value: "Game Console",   prefix: "GCN", label: "Game Console (Disc / Cartridge)",group: "Games" },
  { value: "Digital Key",    prefix: "GDK", label: "Digital Key / CD-Key",           group: "Games" },
  { value: "Voucher Game",   prefix: "VCH", label: "Voucher & Gift Card",            group: "Games" },

  // --- Consoles & Hardware ---
  { value: "Console",        prefix: "CNS", label: "Console (PS5, Xbox, Switch)",    group: "Consoles" },
  { value: "Handheld",       prefix: "HND", label: "Handheld (Steam Deck, ROG)",     group: "Consoles" },

  // --- Accessories & Others ---
  { value: "Gaming Chair",   prefix: "CHR", label: "Gaming Chair",                   group: "Accessories" },
  { value: "Cable & Adapter",prefix: "CBL", label: "Cable & Adapter",                group: "Accessories" },
  { value: "Merchandise",    prefix: "MCH", label: "Merchandise & Collectibles",     group: "Accessories" },
  { value: "Accessories",    prefix: "ACC", label: "Gaming Accessories",             group: "Accessories" },
  { value: "Other",          prefix: "OTH", label: "Other",                          group: "Other" },
];

/**
 * Predefined units of measurement for store products.
 */
const STORE_UNITS = [
  { value: "Pcs",     label: "Pieces (Pcs)" },
  { value: "Unit",    label: "Unit" },
  { value: "Box",     label: "Box" },
  { value: "Set",     label: "Set (Bundle)" },
  { value: "Pack",    label: "Pack" },
  { value: "Key",     label: "Digital Key / License" },
  { value: "Voucher", label: "Voucher / Card" },
  { value: "Pair",    label: "Pair" },
];

/** Build a short code prefix from the category using the predefined map. */
function buildCategoryCodePrefix(category) {
  const cat = (category || "").toString().trim().toLowerCase();
  const match = STORE_CATEGORIES.find(
    (c) => c.value.toLowerCase() === cat
  );
  if (match) return match.prefix;
  // Fallback: take first 3 uppercase letters
  const cleaned = cat.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return cleaned.substring(0, 3) || "PRD";
}

function generateProductCode(category, existingCodes) {
  const prefix = buildCategoryCodePrefix(category);
  const used = new Set((existingCodes || []).map((c) => (c || "").toString().toUpperCase()));
  let n = 1;
  let code;
  do {
    code = `${prefix}-${String(n).padStart(3, "0")}`;
    n += 1;
  } while (used.has(code));
  return code;
}

/* ---------- PWA: Service Worker Registration & Network Status ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                showToast("New update available! Reload to apply latest changes.", "info", 6000);
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  });
}

window.addEventListener("online", () => {
  showToast("Internet connection restored.", "success", 3000);
});

window.addEventListener("offline", () => {
  showToast("Offline mode active. Invenza is running from local cache.", "info", 5000);
});
