/* ==========================================================================
   INVENZA — Products (Inventory) Page Logic
   Handles: Read (list + search + filter), Create, Update, Delete,
   and Supabase Storage image uploads.
   ========================================================================== */

let allProducts = [];
let selectedImageFile = null;
let editingProductId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();
  await loadCurrentProfile();
  initUserNavbar();
  initPasswordToggles();

  bindToolbarEvents();
  bindModalEvents();

  await loadProducts();
});

/* ---------------------------------------------------------------------- */
/*  READ — Load & render product list                                     */
/* ---------------------------------------------------------------------- */

async function loadProducts() {
  const tableBody = document.getElementById("products-table-body");
  const cardsWrap = document.getElementById("products-cards");
  const emptyState = document.getElementById("products-empty");
  const loadingRow = document.getElementById("products-loading");

  if (loadingRow) loadingRow.classList.remove("hidden");
  if (emptyState) emptyState.classList.add("hidden");

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    allProducts = data || [];
    populateCategoryFilter(allProducts);
    renderProducts(allProducts);
  } catch (err) {
    console.error(err);
    showToast(translateError(err), "error");
  } finally {
    if (loadingRow) loadingRow.classList.add("hidden");
  }
}

function populateCategoryFilter(products) {
  const select = document.getElementById("filter-category");
  if (!select) return;
  const current = select.value;
  const productCats = products.map((p) => p.category).filter(Boolean);
  const predefinedCats = (typeof STORE_CATEGORIES !== "undefined")
    ? STORE_CATEGORIES.map((c) => c.value)
    : [];
  const categories = [...new Set([...predefinedCats, ...productCats])].sort();
  select.innerHTML =
    `<option value="">All Categories</option>` +
    categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if (categories.includes(current)) select.value = current;
}

function renderProducts(products) {
  const tableBody = document.getElementById("products-table-body");
  const cardsWrap = document.getElementById("products-cards");
  const emptyState = document.getElementById("products-empty");

  if (!products.length) {
    if (tableBody) tableBody.innerHTML = "";
    if (cardsWrap) cardsWrap.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }
  if (emptyState) emptyState.classList.add("hidden");

  if (tableBody) tableBody.innerHTML = products.map(renderTableRow).join("");
  if (cardsWrap) cardsWrap.innerHTML = products.map(renderProductCard).join("");

  // Bind row/card click -> detail page
  document.querySelectorAll("[data-detail-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-action]")) return; // ignore action buttons
      window.location.href = `product-detail.html?id=${el.dataset.detailId}`;
    });
  });

  // Bind action buttons
  document.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(btn.dataset.id);
    });
  });
  document.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteProduct(btn.dataset.id);
    });
  });
}

function renderTableRow(p) {
  const status = getStockStatus(p.stock);
  const statusColors = {
    "badge-success": "#059669",
    "badge-warning": "#D97706",
    "badge-danger": "#DC2626"
  };
  const statusColor = statusColors[status.cls] || "#059669";
  const img = p.image_url
    ? `<img src="${escapeHtml(p.image_url)}" class="product-thumb" alt="${escapeHtml(p.name)}">`
    : `<div class="product-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);"><i class="bi bi-box-seam"></i></div>`;
  return `
    <tr data-detail-id="${p.id}">
      <td>${img}</td>
      <td style="font-weight:600;font-size:0.88rem;color:var(--color-primary-dark);">${escapeHtml(p.code)}</td>
      <td style="font-weight:600;">${escapeHtml(p.name)}</td>
      <td><span class="badge" style="background:rgba(224,242,254,0.7);color:#0284c7;">${escapeHtml(p.category)}</span></td>
      <td style="font-weight:600;">${formatRupiah(p.price)}</td>
      <td>${p.stock} <span class="status-text ${status.cls}" style="margin-left:6px;font-size:12px;font-weight:700;color:${statusColor};background:none!important;background-color:transparent!important;padding:0;border:none;">${status.label}</span></td>
      <td>${escapeHtml(p.unit)}</td>
      <td style="color:var(--color-text-muted);">${escapeHtml(p.supplier)}</td>
      <td style="text-align:right;">
        <div class="row-actions" style="justify-content:flex-end;">
          <button class="btn-icon" data-action="edit" data-id="${p.id}" title="Edit Item"><i class="bi bi-pencil-square"></i></button>
          <button class="btn-icon" data-action="delete" data-id="${p.id}" title="Delete Item"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>`;
}

function renderProductCard(p) {
  const status = getStockStatus(p.stock);
  const statusColors = {
    "badge-success": "#059669",
    "badge-warning": "#D97706",
    "badge-danger": "#DC2626"
  };
  const statusColor = statusColors[status.cls] || "#059669";
  const img = p.image_url
    ? `<img src="${escapeHtml(p.image_url)}" class="product-thumb" alt="${escapeHtml(p.name)}">`
    : `<div class="product-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);"><i class="bi bi-box-seam"></i></div>`;
  const kondisi = p.kondisi || "-";
  return `
    <div class="product-card" data-detail-id="${p.id}">
      ${img}
      <div class="product-card-body">
        <div class="product-card-title">${escapeHtml(p.name)}</div>
        <div class="product-card-sub">${escapeHtml(p.code)} · ${escapeHtml(p.category)} · ${escapeHtml(kondisi)}</div>
        <div class="product-card-meta">
          <span class="product-card-price">${formatRupiah(p.price)}</span>
          <span class="status-text ${status.cls}" style="font-size:12px;font-weight:700;color:${statusColor};background:none!important;background-color:transparent!important;padding:0;border:none;">${status.label}</span>
        </div>
      </div>
      <div class="product-card-actions">
        <button class="btn-icon" data-action="edit" data-id="${p.id}" title="Edit Item"><i class="bi bi-pencil-square"></i></button>
        <button class="btn-icon" data-action="delete" data-id="${p.id}" title="Delete Item"><i class="bi bi-trash"></i></button>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------------- */
/*  SEARCH & FILTER                                                        */
/* ---------------------------------------------------------------------- */

function bindToolbarEvents() {
  const searchInput = document.getElementById("search-input");
  const topbarSearch = document.getElementById("topbar-search-input");
  const categoryFilter = document.getElementById("filter-category");
  const stockFilter = document.getElementById("filter-stock");
  const addBtn = document.getElementById("add-product-btn");

  function applyFilters() {
    const query = ((searchInput ? searchInput.value : "") || (topbarSearch ? topbarSearch.value : "") || "").trim().toLowerCase();
    const category = categoryFilter ? categoryFilter.value : "";
    const stockStatus = stockFilter ? stockFilter.value : "";

    const filtered = allProducts.filter((p) => {
      const matchesQuery =
        !query ||
        [p.code, p.name, p.category, p.supplier, p.publisher, p.lokasi].some((f) =>
          (f || "").toLowerCase().includes(query)
        );
      const matchesCategory = !category || p.category === category;
      const matchesStock = !stockStatus || getStockStatus(p.stock).key === stockStatus;
      return matchesQuery && matchesCategory && matchesStock;
    });

    renderProducts(filtered);
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (topbarSearch) topbarSearch.value = searchInput.value;
      applyFilters();
    });
  }

  if (topbarSearch) {
    topbarSearch.addEventListener("input", () => {
      if (searchInput) searchInput.value = topbarSearch.value;
      applyFilters();
    });
  }

  if (categoryFilter) categoryFilter.addEventListener("change", applyFilters);
  if (stockFilter) stockFilter.addEventListener("change", applyFilters);
  if (addBtn) addBtn.addEventListener("click", openAddModal);
}

/* ---------------------------------------------------------------------- */
/*  MODAL — shared for Create & Update                                    */
/* ---------------------------------------------------------------------- */

function bindModalEvents() {
  const modal = document.getElementById("product-modal");
  if (!modal) return;
  const closeButtons = modal.querySelectorAll("[data-close-modal]");
  const form = document.getElementById("product-form");
  const fileInput = document.getElementById("product-image-input");
  const fileWrap = document.getElementById("file-input-wrap");
  const preview = document.getElementById("image-preview");

  closeButtons.forEach((btn) => btn.addEventListener("click", closeProductModal));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeProductModal();
  });

  if (fileWrap && fileInput) {
    fileWrap.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showToast("File must be a valid image format (PNG, JPG, WebP).", "error");
        fileInput.value = "";
        return;
      }
      selectedImageFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    });
  }

  if (form) form.addEventListener("submit", handleProductFormSubmit);

  const catSelect = document.getElementById("product-category");
  const codeInput = document.getElementById("product-code");
  if (catSelect) {
    catSelect.addEventListener("change", handleCategoryChange);
  }
  if (codeInput) {
    codeInput.addEventListener("input", updateCodeHelper);
  }
}

/**
 * Triggered whenever the user chooses a category from the dropdown.
 * Automatically generates and populates the next sequence code (e.g. KB-001, KB-002, CPU-001).
 */
function handleCategoryChange() {
  const catSelect = document.getElementById("product-category");
  const codeInput = document.getElementById("product-code");
  if (!catSelect || !codeInput) return;

  const category = (catSelect.value || "").trim();
  if (!category) {
    if (!editingProductId) codeInput.value = "";
    updateCodeHelper();
    return;
  }

  // When adding a new product (or if user cleared code in edit mode),
  // automatically calculate the next sequence code and populate the input.
  if (!editingProductId || !codeInput.value.trim()) {
    const existingCodes = allProducts
      .filter((p) => !editingProductId || String(p.id) !== String(editingProductId))
      .map((p) => p.code);
    const generatedCode = generateProductCode(category, existingCodes);
    codeInput.value = generatedCode;
  }
  updateCodeHelper();
}

function updateCodeHelper() {
  const codeHelper = document.getElementById("code-helper-text");
  if (!codeHelper) return;

  const category = (document.getElementById("product-category")?.value || "").trim();
  const code = (document.getElementById("product-code")?.value || "").trim();

  if (editingProductId) {
    codeHelper.textContent = "Current item SKU code. Edit if you wish to reassign SKU.";
    return;
  }

  if (code && category) {
    const prefix = buildCategoryCodePrefix(category);
    codeHelper.innerHTML = `Auto-assigned SKU for <strong>${escapeHtml(category)}</strong>: <code>${escapeHtml(code)}</code> (Next available sequence for prefix <code>${prefix}</code>)`;
  } else if (category) {
    const preview = generateProductCode(category, allProducts.map((p) => p.code));
    codeHelper.innerHTML = `Suggested code for <strong>${escapeHtml(category)}</strong>: <code>${escapeHtml(preview)}</code>`;
  } else {
    codeHelper.textContent = "Select a category above to automatically generate item code (e.g. KB-001, CPU-001).";
  }
}

function openAddModal() {
  editingProductId = null;
  selectedImageFile = null;
  const title = document.getElementById("product-modal-title");
  if (title) title.textContent = "Add Product";
  const form = document.getElementById("product-form");
  if (form) form.reset();
  const catSelect = document.getElementById("product-category");
  if (catSelect) catSelect.value = "";
  const unitSelect = document.getElementById("product-unit");
  if (unitSelect) unitSelect.value = "Pcs";
  const kondisi = document.getElementById("product-kondisi");
  if (kondisi) kondisi.value = "Bagus";
  const preview = document.getElementById("image-preview");
  if (preview) preview.classList.add("hidden");
  clearFormErrors();
  updateCodeHelper();
  const modal = document.getElementById("product-modal");
  if (modal) modal.classList.remove("hidden");
}

function openEditModal(id) {
  const product = allProducts.find((p) => String(p.id) === String(id));
  if (!product) return;

  editingProductId = id;
  selectedImageFile = null;
  clearFormErrors();

  const title = document.getElementById("product-modal-title");
  if (title) title.textContent = "Edit Product";

  const setVal = (fieldId, val) => {
    const el = document.getElementById(fieldId);
    if (el) el.value = val || "";
  };

  setVal("product-code", product.code);
  setVal("product-name", product.name);

  // Set category dropdown, creating custom option if category is not pre-listed
  const catSelect = document.getElementById("product-category");
  if (catSelect && product.category) {
    const exists = Array.from(catSelect.options).some((opt) => opt.value === product.category);
    if (!exists) {
      const customOpt = document.createElement("option");
      customOpt.value = product.category;
      customOpt.textContent = product.category;
      catSelect.appendChild(customOpt);
    }
    catSelect.value = product.category;
  }

  setVal("product-price", product.price);
  setVal("product-stock", product.stock);

  // Set unit dropdown, creating custom option if unit is not pre-listed
  const unitSelect = document.getElementById("product-unit");
  if (unitSelect && product.unit) {
    const exists = Array.from(unitSelect.options).some((opt) => opt.value === product.unit);
    if (!exists) {
      const customOpt = document.createElement("option");
      customOpt.value = product.unit;
      customOpt.textContent = product.unit;
      unitSelect.appendChild(customOpt);
    }
    unitSelect.value = product.unit;
  }

  setVal("product-supplier", product.supplier);
  setVal("product-publisher", product.publisher);
  setVal("product-kondisi", product.kondisi || "Bagus");
  setVal("product-lokasi", product.lokasi);
  setVal("product-catatan", product.catatan);

  const preview = document.getElementById("image-preview");
  if (preview) {
    if (product.image_url) {
      preview.src = product.image_url;
      preview.classList.remove("hidden");
    } else {
      preview.classList.add("hidden");
    }
  }

  updateCodeHelper();
  const modal = document.getElementById("product-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeProductModal() {
  const modal = document.getElementById("product-modal");
  if (modal) modal.classList.add("hidden");
  const form = document.getElementById("product-form");
  if (form) form.reset();
  const fileInput = document.getElementById("product-image-input");
  if (fileInput) fileInput.value = "";
  selectedImageFile = null;
  editingProductId = null;
}

function clearFormErrors() {
  document.querySelectorAll("#product-form .form-error").forEach((el) => (el.textContent = ""));
}

/* ---------------------------------------------------------------------- */
/*  CREATE + UPDATE — validation, image upload, save                      */
/* ---------------------------------------------------------------------- */

function validateProductForm(values) {
  const errors = {};
  if (!values.name) errors.name = "Product name is required.";
  if (!values.category) errors.category = "Category is required.";

  if (values.price === "" || values.price === null) {
    errors.price = "Unit price is required.";
  } else if (isNaN(Number(values.price))) {
    errors.price = "Unit price must be a valid number.";
  } else if (Number(values.price) < 0) {
    errors.price = "Unit price cannot be negative.";
  }

  if (values.stock === "" || values.stock === null) {
    errors.stock = "Stock quantity is required.";
  } else if (isNaN(Number(values.stock))) {
    errors.stock = "Stock quantity must be a valid number.";
  } else if (Number(values.stock) < 0) {
    errors.stock = "Stock quantity cannot be negative.";
  }

  if (!values.unit) errors.unit = "Unit of measurement is required.";
  if (!values.supplier) errors.supplier = "Supplier name is required.";

  return errors;
}

function showFormErrors(errors) {
  clearFormErrors();
  Object.entries(errors).forEach(([field, message]) => {
    const el = document.getElementById(`error-${field}`);
    if (el) el.textContent = message;
  });
}

async function isDuplicateCode(code, excludeId) {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  let query = supabaseClient.from("products").select("id").eq("code", code).eq("user_id", userId);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data && data.length > 0;
}

async function uploadProductImage(file, userId) {
  const fileName = `${userId}/${buildUniqueFileName(file.name)}`;
  const { error: uploadError } = await supabaseClient.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(fileName, file, { cacheControl: "3600", upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabaseClient.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(fileName);
  return { url: data.publicUrl, path: fileName };
}

async function deleteProductImageByUrl(imageUrl) {
  if (!imageUrl) return;
  try {
    const parts = imageUrl.split(`${PRODUCT_IMAGE_BUCKET}/`);
    if (parts.length < 2) return;
    const path = decodeURIComponent(parts[1]);
    await supabaseClient.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  } catch (err) {
    console.warn("Failed to delete obsolete image:", err);
  }
}

async function handleProductFormSubmit(e) {
  e.preventDefault();

  const values = {
    code: (document.getElementById("product-code")?.value || "").trim(),
    name: (document.getElementById("product-name")?.value || "").trim(),
    category: (document.getElementById("product-category")?.value || "").trim(),
    price: document.getElementById("product-price")?.value,
    stock: document.getElementById("product-stock")?.value,
    unit: (document.getElementById("product-unit")?.value || "").trim(),
    supplier: (document.getElementById("product-supplier")?.value || "").trim(),
    publisher: (document.getElementById("product-publisher")?.value || "").trim(),
    kondisi: document.getElementById("product-kondisi")?.value,
    lokasi: (document.getElementById("product-lokasi")?.value || "").trim(),
    catatan: (document.getElementById("product-catatan")?.value || "").trim(),
  };

  const errors = validateProductForm(values);
  if (Object.keys(errors).length) {
    showFormErrors(errors);
    return;
  }
  clearFormErrors();

  const submitBtn = document.getElementById("product-submit-btn");
  setButtonLoading(submitBtn, true, editingProductId ? "Saving Changes..." : "Saving Product...");

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    let finalCode = values.code;
    if (!finalCode) {
      const existingCodes = allProducts
        .filter((p) => String(p.id) !== String(editingProductId))
        .map((p) => p.code);
      finalCode = generateProductCode(values.category, existingCodes);
    }

    const duplicate = await isDuplicateCode(finalCode, editingProductId);
    if (duplicate) {
      showFormErrors({ code: "This item code is already in use." });
      setButtonLoading(submitBtn, false);
      return;
    }

    let imageUrl = null;
    let oldImageUrl = null;

    if (editingProductId) {
      const existing = allProducts.find((p) => String(p.id) === String(editingProductId));
      oldImageUrl = existing ? existing.image_url : null;
      imageUrl = oldImageUrl;
    }

    if (selectedImageFile) {
      setButtonLoading(submitBtn, true, "Uploading image...");
      const uploaded = await uploadProductImage(selectedImageFile, userId);
      imageUrl = uploaded.url;
    }

    const payload = {
      code: finalCode,
      name: values.name,
      category: values.category,
      price: Number(values.price),
      stock: Number(values.stock),
      unit: values.unit,
      supplier: values.supplier,
      publisher: values.publisher || null,
      kondisi: values.kondisi || "Bagus",
      lokasi: values.lokasi || null,
      catatan: values.catatan || null,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    };

    setButtonLoading(submitBtn, true, "Saving product...");

    if (editingProductId) {
      const { error } = await supabaseClient
        .from("products")
        .update(payload)
        .eq("id", editingProductId)
        .eq("user_id", userId);
      if (error) throw error;

      if (selectedImageFile && oldImageUrl && oldImageUrl !== imageUrl) {
        await deleteProductImageByUrl(oldImageUrl);
      }
      showToast("Product updated successfully", "success");
    } else {
      const { error } = await supabaseClient.from("products").insert({ ...payload, user_id: userId });
      if (error) throw error;
      showToast("Product added successfully", "success");
    }

    closeProductModal();
    await loadProducts();
  } catch (err) {
    console.error(err);
    showToast(translateError(err), "error");
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/* ---------------------------------------------------------------------- */
/*  DELETE                                                                 */
/* ---------------------------------------------------------------------- */

async function deleteProduct(id) {
  const product = allProducts.find((p) => String(p.id) === String(id));
  if (!product) return;

  const confirmed = await confirmDialog({
    title: "Delete Product",
    message: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
    confirmText: "Delete",
    cancelText: "Cancel",
    danger: true,
  });
  if (!confirmed) return;

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabaseClient.from("products").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;

    if (product.image_url) {
      await deleteProductImageByUrl(product.image_url);
    }

    showToast("Product deleted successfully", "success");
    await loadProducts();
  } catch (err) {
    console.error(err);
    showToast(translateError(err), "error");
  }
}
