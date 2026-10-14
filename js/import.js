/* ==========================================================================
   INVENZA — Import Data Page Logic
   Flow: Select file -> Parse -> Preview -> Validate -> Confirm -> Insert.
   Security: Always binds rows to getCurrentUserId() (authenticated session).
   ========================================================================== */

let importParsedRows = [];

const IMPORT_FIELD_ALIASES = {
  code: ["code", "item code", "item_code", "sku", "kode", "kode barang", "kode_barang"],
  name: ["name", "product name", "product_name", "item", "product", "nama", "nama barang", "nama_barang"],
  category: ["category", "kategori", "type"],
  price: ["price", "unit price", "unit_price", "cost", "harga"],
  stock: ["stock", "quantity", "qty", "stok"],
  unit: ["unit", "satuan", "uom"],
  supplier: ["supplier", "vendor", "distributor"],
  publisher: ["publisher", "brand", "manufacturer", "publisher game", "publisher_game", "game publisher"],
  kondisi: ["condition", "kondisi", "kondisi barang", "status", "kondisi_barang"],
  lokasi: ["location", "storage location", "lokasi", "lokasi barang", "warehouse", "lokasi_barang"],
  catatan: ["notes", "remarks", "description", "catatan"],
  image_url: ["image_url", "image", "image url", "photo", "gambar", "gambar_url", "gambar url"],
};

function normalizeConditionValue(val) {
  if (!val) return "Bagus";
  const s = val.toString().trim().toLowerCase();
  if (["bagus", "new", "brand new", "excellent", "good"].includes(s)) return "Bagus";
  if (["rusak ringan", "fair", "minor defect", "used"].includes(s)) return "Rusak Ringan";
  if (["rusak", "damaged", "broken", "faulty"].includes(s)) return "Rusak";
  return "Bagus";
}

function isLikelyValidImageUrl(value) {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (e) {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();
  await loadCurrentProfile();
  initUserNavbar();
  bindImportEvents();
});

function bindImportEvents() {
  const dropWrap = document.getElementById("import-drop-wrap");
  const fileInput = document.getElementById("import-file-input");
  const confirmBtn = document.getElementById("import-confirm-btn");
  const cancelBtn = document.getElementById("import-cancel-btn");

  if (!dropWrap || !fileInput) return;

  dropWrap.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) handleFileSelected(file);
  });

  if (confirmBtn) confirmBtn.addEventListener("click", runImport);
  if (cancelBtn) cancelBtn.addEventListener("click", resetImportUI);
}

function resetImportUI() {
  importParsedRows = [];
  const fileInput = document.getElementById("import-file-input");
  if (fileInput) fileInput.value = "";
  const filename = document.getElementById("import-filename");
  if (filename) filename.textContent = "";
  const errorBox = document.getElementById("import-error-box");
  if (errorBox) errorBox.textContent = "";
  const prevSec = document.getElementById("import-preview-section");
  if (prevSec) prevSec.classList.add("hidden");
  const resSec = document.getElementById("import-result-section");
  if (resSec) resSec.classList.add("hidden");
}

/* ---------------------------------------------------------------------- */
/*  PARSE                                                                  */
/* ---------------------------------------------------------------------- */

async function handleFileSelected(file) {
  const errorBox = document.getElementById("import-error-box");
  if (errorBox) errorBox.textContent = "";
  const resSec = document.getElementById("import-result-section");
  if (resSec) resSec.classList.add("hidden");
  const nameEl = document.getElementById("import-filename");
  if (nameEl) nameEl.textContent = file.name;

  const ext = (file.name.split(".").pop() || "").toLowerCase();

  try {
    let rawRows = [];
    if (ext === "json") {
      rawRows = await parseJsonFile(file);
    } else if (["csv", "xlsx", "xls"].includes(ext)) {
      rawRows = await parseSheetFile(file);
    } else {
      showImportError("Unsupported file format. Please upload .xlsx, .xls, .csv, or .json.");
      return;
    }

    if (!rawRows.length) {
      showImportError("File contains no readable data rows.");
      return;
    }

    importParsedRows = normalizeImportRows(rawRows);
    renderImportPreview(importParsedRows);
  } catch (err) {
    console.error(err);
    showImportError("Failed to parse file: " + translateError(err));
  }
}

function showImportError(message) {
  const errorBox = document.getElementById("import-error-box");
  if (errorBox) errorBox.textContent = message;
  const prevSec = document.getElementById("import-preview-section");
  if (prevSec) prevSec.classList.add("hidden");
}

function parseJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        let arr = null;
        if (Array.isArray(data)) arr = data;
        else if (data && Array.isArray(data.products)) arr = data.products;
        else if (data && data.data && Array.isArray(data.data)) arr = data.data;
        if (!arr) {
          reject(new Error("JSON data must contain an array of product objects."));
          return;
        }
        resolve(arr);
      } catch (e) {
        reject(new Error("Invalid JSON file formatting."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read JSON file."));
    reader.readAsText(file);
  });
}

function parseSheetFile(file) {
  return new Promise((resolve, reject) => {
    if (typeof XLSX === "undefined") {
      reject(new Error("Spreadsheet parser library is not loaded. Please check your network connection."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows);
      } catch (e) {
        reject(new Error("Failed to read spreadsheet contents."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

/* ---------------------------------------------------------------------- */
/*  NORMALIZE + VALIDATE                                                   */
/* ---------------------------------------------------------------------- */

function findAliasValue(row, aliases) {
  for (const key of Object.keys(row)) {
    const norm = key.toString().trim().toLowerCase();
    if (aliases.includes(norm)) return row[key];
  }
  return undefined;
}

function normalizeImportRows(rawRows) {
  return rawRows.map((row, idx) => {
    const get = (field) => {
      const v = findAliasValue(row, IMPORT_FIELD_ALIASES[field]);
      return v === undefined || v === null ? "" : String(v).trim();
    };

    const name = get("name");
    const category = get("category");

    const priceRaw = get("price").replace(/[^\d.-]/g, "");
    const stockRaw = get("stock").replace(/[^\d.-]/g, "");
    const price = priceRaw === "" ? 0 : Number(priceRaw);
    const stock = stockRaw === "" ? 0 : Number(stockRaw);

    const kondisi = normalizeConditionValue(get("kondisi"));

    const gambarRaw = get("image_url");
    let imageUrl = null;
    let imageWarning = false;
    if (gambarRaw) {
      if (isLikelyValidImageUrl(gambarRaw)) {
        imageUrl = gambarRaw;
      } else {
        imageWarning = true;
      }
    }

    const errors = [];
    if (!name) errors.push("Missing name");
    if (!category) errors.push("Missing category");
    if (isNaN(price) || price < 0) errors.push("Invalid price");
    if (isNaN(stock) || stock < 0) errors.push("Invalid stock");

    return {
      _row: idx + 1,
      code: get("code"),
      name,
      category,
      price: isNaN(price) ? 0 : price,
      stock: isNaN(stock) ? 0 : stock,
      unit: get("unit") || "Pcs",
      supplier: get("supplier") || "-",
      publisher: get("publisher") || null,
      kondisi,
      lokasi: get("lokasi") || null,
      catatan: get("catatan") || null,
      image_url: imageUrl,
      _imageWarning: imageWarning,
      _errors: errors,
    };
  });
}

function renderImportPreview(rows) {
  const section = document.getElementById("import-preview-section");
  const body = document.getElementById("import-preview-body");
  const countEl = document.getElementById("import-preview-count");

  if (!section || !body || !countEl) return;

  countEl.textContent = rows.length;

  const MAX_PREVIEW_ROWS = 200;
  const toShow = rows.slice(0, MAX_PREVIEW_ROWS);

  body.innerHTML = toShow
    .map((r) => {
      const statusBadge = r._errors.length
        ? `<span class="badge badge-danger" title="${escapeHtml(r._errors.join(", "))}">Error</span>`
        : `<span class="badge badge-success">Ready</span>`;
      let gambarCell = '<span class="import-image-status none">-</span>';
      if (r._imageWarning) {
        gambarCell = '<span class="import-image-status warn" title="Invalid image URL. Item will be imported without an image.">⚠ Invalid</span>';
      } else if (r.image_url) {
        gambarCell = '<span class="import-image-status ok" title="' + escapeHtml(r.image_url) + '">🖼 Attached</span>';
      }
      return `
      <tr>
        <td>${r._row}</td>
        <td><code>${escapeHtml(r.code || "(auto)")}</code></td>
        <td style="font-weight:600;">${escapeHtml(r.name)}</td>
        <td><span class="badge" style="background:rgba(224,242,254,0.7);color:#0284c7;">${escapeHtml(r.category)}</span></td>
        <td>${formatRupiah(r.price)}</td>
        <td>${r.stock}</td>
        <td>${escapeHtml(r.kondisi)}</td>
        <td>${gambarCell}</td>
        <td>${statusBadge}</td>
      </tr>`;
    })
    .join("");

  if (rows.length > MAX_PREVIEW_ROWS) {
    body.innerHTML += `<tr><td colspan="9" style="text-align:center;color:var(--color-text-muted);padding:12px;">... and ${
      rows.length - MAX_PREVIEW_ROWS
    } additional rows</td></tr>`;
  }

  section.classList.remove("hidden");
  const resSec = document.getElementById("import-result-section");
  if (resSec) resSec.classList.add("hidden");
}

/* ---------------------------------------------------------------------- */
/*  IMPORT (INSERT)                                                        */
/* ---------------------------------------------------------------------- */

async function runImport() {
  if (!importParsedRows.length) return;

  const confirmBtn = document.getElementById("import-confirm-btn");
  setButtonLoading(confirmBtn, true, "Importing...");

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { data: existing, error: fetchError } = await supabaseClient
      .from("products")
      .select("code")
      .eq("user_id", userId);
    if (fetchError) throw fetchError;

    const existingCodes = new Set((existing || []).map((p) => (p.code || "").toUpperCase()));
    const usedInBatch = new Set();

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of importParsedRows) {
      if (row._errors.length) {
        failed++;
        continue;
      }

      let code = row.code;
      if (!code) {
        code = generateProductCode(row.category, [...existingCodes, ...usedInBatch]);
      }
      const codeUpper = code.toUpperCase();

      if (existingCodes.has(codeUpper) || usedInBatch.has(codeUpper)) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabaseClient.from("products").insert({
        code,
        name: row.name,
        category: row.category,
        price: row.price,
        stock: row.stock,
        unit: row.unit,
        supplier: row.supplier,
        publisher: row.publisher,
        kondisi: row.kondisi,
        lokasi: row.lokasi,
        catatan: row.catatan,
        image_url: row.image_url,
        user_id: userId,
      });

      if (insertError) {
        console.error(insertError);
        failed++;
      } else {
        success++;
        usedInBatch.add(codeUpper);
      }
    }

    showImportResult(success, skipped, failed);
    showToast(`Import complete — ${success} imported, ${skipped} skipped, ${failed} failed.`, success > 0 ? "success" : "error");
  } catch (err) {
    console.error(err);
    showToast(translateError(err), "error");
  } finally {
    setButtonLoading(confirmBtn, false);
  }
}

function showImportResult(success, skipped, failed) {
  const sEl = document.getElementById("result-success");
  if (sEl) sEl.textContent = success;
  const skEl = document.getElementById("result-skipped");
  if (skEl) skEl.textContent = skipped;
  const fEl = document.getElementById("result-failed");
  if (fEl) fEl.textContent = failed;

  const prevSec = document.getElementById("import-preview-section");
  if (prevSec) prevSec.classList.add("hidden");
  const resSec = document.getElementById("import-result-section");
  if (resSec) resSec.classList.remove("hidden");
}
