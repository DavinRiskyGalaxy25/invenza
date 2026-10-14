/* ==========================================================================
   INVENZA — Download Data Page Logic
   Export inventory datasets scoped strictly to authenticated user's account.
   ========================================================================== */

let myProducts = [];

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();
  await loadCurrentProfile();
  initUserNavbar();

  await loadMyProductsForExport();

  const jsonBtn = document.getElementById("download-json-btn");
  const excelBtn = document.getElementById("download-excel-btn");
  if (jsonBtn) jsonBtn.addEventListener("click", downloadAsJson);
  if (excelBtn) excelBtn.addEventListener("click", downloadAsExcel);
});

async function loadMyProductsForExport() {
  const infoEl = document.getElementById("download-count-info");
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    myProducts = data || [];
    if (infoEl) {
      infoEl.textContent = myProducts.length
        ? `${myProducts.length} inventory item${myProducts.length === 1 ? "" : "s"} ready for export.`
        : "No inventory records available to export.";
    }
  } catch (err) {
    console.error(err);
    if (infoEl) infoEl.textContent = "Failed to load catalog count.";
    showToast(translateError(err), "error");
  }
}

/* ---------- Helpers ---------- */

function todayStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function triggerFileDownload(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- JSON Export ---------- */

function downloadAsJson() {
  if (!myProducts.length) {
    showToast("No inventory records found to export.", "error");
    return;
  }
  const exportData = myProducts.map((p) => ({
    code: p.code,
    name: p.name,
    category: p.category,
    price: p.price,
    stock: p.stock,
    unit: p.unit,
    supplier: p.supplier,
    publisher: p.publisher || null,
    kondisi: p.kondisi || null,
    lokasi: p.lokasi || null,
    catatan: p.catatan || null,
    image_url: p.image_url || null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
  const json = JSON.stringify(exportData, null, 2);
  triggerFileDownload(json, `invenza-inventory-${todayStamp()}.json`, "application/json");
  showToast("JSON dataset exported successfully", "success");
}

/* ---------- Excel Export ---------- */

function downloadAsExcel() {
  if (!myProducts.length) {
    showToast("No inventory records found to export.", "error");
    return;
  }
  if (typeof XLSX === "undefined") {
    showToast("Excel generator library is not loaded. Please verify internet connection.", "error");
    return;
  }

  const rows = myProducts.map((p) => ({
    "Item Code": p.code,
    "Product Name": p.name,
    "Category": p.category,
    "Unit Price (IDR)": Number(p.price) || 0,
    "Stock Quantity": Number(p.stock) || 0,
    "Unit": p.unit,
    "Supplier": p.supplier,
    "Brand / Publisher": p.publisher || "",
    "Condition": p.kondisi || "",
    "Storage Location": p.lokasi || "",
    "Notes & Remarks": p.catatan || "",
    "Image URL": p.image_url || "",
    "Date Created": formatDate(p.created_at),
    "Date Modified": formatDate(p.updated_at),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Catalog");
  XLSX.writeFile(workbook, `invenza-inventory-${todayStamp()}.xlsx`);
  showToast("Excel spreadsheet exported successfully", "success");
}
