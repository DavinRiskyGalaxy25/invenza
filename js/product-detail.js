/* ==========================================================================
   INVENZA — Product Detail Page Logic
   ========================================================================== */

let currentProduct = null;

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();
  await loadCurrentProfile();
  initUserNavbar();

  const id = getQueryParam("id");
  if (!id) {
    showNotFound();
    return;
  }

  await loadProductDetail(id);

  document.getElementById("detail-edit-btn").addEventListener("click", () => {
    window.location.href = `products.html?edit=${id}`;
  });
  document.getElementById("detail-delete-btn").addEventListener("click", () => deleteFromDetail(id));
});

async function loadProductDetail(id) {
  const skeletonEl = document.getElementById("detail-skeleton");
  const contentEl = document.getElementById("detail-content");
  const notFoundEl = document.getElementById("detail-not-found");

  if (skeletonEl) skeletonEl.classList.remove("hidden");
  if (contentEl) contentEl.classList.add("hidden");
  if (notFoundEl) notFoundEl.classList.add("hidden");

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      showNotFound();
      return;
    }

    currentProduct = data;
    renderDetail(data);
    if (skeletonEl) skeletonEl.classList.add("hidden");
    if (contentEl) contentEl.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    showToast(translateError(err), "error");
    showNotFound();
  } finally {
    if (skeletonEl) skeletonEl.classList.add("hidden");
  }
}

function showNotFound() {
  const skeletonEl = document.getElementById("detail-skeleton");
  const contentEl = document.getElementById("detail-content");
  const notFoundEl = document.getElementById("detail-not-found");
  if (skeletonEl) skeletonEl.classList.add("hidden");
  if (contentEl) contentEl.classList.add("hidden");
  if (notFoundEl) notFoundEl.classList.remove("hidden");
}

function renderDetail(p) {
  const pageTitle = document.getElementById("detail-page-title");
  if (pageTitle) pageTitle.textContent = `${p.name} — Invenza`;

  const imageWrap = document.getElementById("detail-image-wrap");
  if (imageWrap) {
    imageWrap.innerHTML = p.image_url
      ? `<img src="${escapeHtml(p.image_url)}" class="detail-image" alt="${escapeHtml(p.name)}">`
      : `<div class="detail-image-placeholder"><i class="bi bi-box-seam"></i></div>`;
  }

  const nameEl = document.getElementById("detail-name");
  if (nameEl) nameEl.textContent = p.name;

  const codeEl = document.getElementById("detail-code");
  if (codeEl) codeEl.textContent = `Item Code: ${p.code}`;

  const status = getStockStatus(p.stock);
  const statusColors = {
    "badge-success": "#059669",
    "badge-warning": "#D97706",
    "badge-danger": "#DC2626"
  };
  const statusColor = statusColors[status.cls] || "#059669";
  const badgeEl = document.getElementById("detail-status-badge");
  if (badgeEl) badgeEl.innerHTML = `<span class="status-text ${status.cls}" style="font-size:13px;font-weight:700;color:${statusColor};background:none!important;background-color:transparent!important;padding:0;border:none;">${status.label}</span>`;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "-";
  };

  setVal("detail-category", p.category);
  setVal("detail-price", formatRupiah(p.price));
  setVal("detail-stock", `${p.stock} ${p.unit || ""}`);
  setVal("detail-supplier", p.supplier);
  setVal("detail-publisher", p.publisher);
  setVal("detail-kondisi", p.kondisi || "Standard / Good");
  setVal("detail-lokasi", p.lokasi);
  setVal("detail-catatan", p.catatan);

  setVal("detail-created", formatDate(p.created_at));
  setVal("detail-updated", formatDate(p.updated_at));
}

async function deleteFromDetail(id) {
  if (!currentProduct) return;

  const confirmed = await confirmDialog({
    title: "Delete Product",
    message: `Are you sure you want to delete "${currentProduct.name}"? This action cannot be undone.`,
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

    if (currentProduct.image_url) {
      const parts = currentProduct.image_url.split(`${PRODUCT_IMAGE_BUCKET}/`);
      if (parts.length >= 2) {
        const path = decodeURIComponent(parts[1]);
        await supabaseClient.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
      }
    }

    showToast("Product deleted successfully", "success");
    setTimeout(() => window.location.replace("products.html"), 600);
  } catch (err) {
    console.error(err);
    showToast(translateError(err), "error");
  }
}
