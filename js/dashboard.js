/* ==========================================================================
   INVENZA — Dashboard Page Logic (English Standard & Interactive Charts)
   Includes Machine Learning Dynamic Greeting & Real-Time Telemetry Engine.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initDynamicGreeting();

  await requireAuth();
  const profile = await loadCurrentProfile();
  initUserNavbar();

  const welcomeName = document.getElementById("welcome-name");
  if (welcomeName) {
    welcomeName.textContent = getDisplayName(profile);
  }

  // Bind topbar quick search
  const searchInput = document.getElementById("topbar-search-input");
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && searchInput.value.trim()) {
        window.location.href = `products.html?search=${encodeURIComponent(searchInput.value.trim())}`;
      }
    });
  }

  // Fullscreen toggle
  const fsBtn = document.getElementById("fullscreen-toggle");
  if (fsBtn) {
    fsBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  await loadDashboardStats();
});

async function loadDashboardStats() {
  const elTotalBarang = document.getElementById("stat-total-barang");
  const elTotalStok = document.getElementById("stat-total-stok");
  const elKategori = document.getElementById("stat-kategori");
  const elMenipis = document.getElementById("stat-menipis");
  const recentBody = document.getElementById("recent-products-body");
  const lowStockBody = document.getElementById("low-stock-body");
  const lowStockDot = document.getElementById("low-stock-dot");

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { data: products, error } = await supabaseClient
      .from("products")
      .select("id, code, name, category, stock, price, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const allProducts = products || [];
    const totalBarang = allProducts.length;
    const totalStok = allProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const categoryMap = {};

    allProducts.forEach((p) => {
      const cat = (p.category || "General").trim();
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, stock: 0 };
      categoryMap[cat].count += 1;
      categoryMap[cat].stock += Number(p.stock) || 0;
    });

    const kategoriUnik = Object.keys(categoryMap);
    const stokMenipis = allProducts.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= LOW_STOCK_THRESHOLD);
    const stokHabis = allProducts.filter((p) => Number(p.stock) === 0);
    const stokAman = allProducts.filter((p) => Number(p.stock) > LOW_STOCK_THRESHOLD);
    const criticalCount = stokMenipis.length + stokHabis.length;

    // Update 4 Stat Cards
    if (elTotalBarang) elTotalBarang.textContent = totalBarang.toLocaleString("en-US");
    if (elTotalStok) elTotalStok.textContent = totalStok.toLocaleString("en-US");
    if (elKategori) elKategori.textContent = kategoriUnik.length;
    if (elMenipis) elMenipis.textContent = criticalCount;

    // Notification Dot
    if (lowStockDot) {
      if (criticalCount > 0) lowStockDot.classList.remove("hidden");
      else lowStockDot.classList.add("hidden");
    }

    // Render Charts
    renderCategoryBarChart(categoryMap);
    renderStockHealthDonut(stokAman.length, stokMenipis.length, stokHabis.length, totalBarang);

    // Recent Products Table (Top 5)
    if (recentBody) {
      const recent = allProducts.slice(0, 5);
      recentBody.innerHTML = recent.length
        ? recent
            .map(
              (p) => `
          <tr onclick="window.location.href='product-detail.html?id=${p.id}'" style="cursor:pointer;">
            <td class="col-code">${escapeHtml(p.code)}</td>
            <td>
              <div style="font-weight:600;color:var(--color-text);">${escapeHtml(p.name)}</div>
              <div class="mobile-sub-meta">${escapeHtml(p.code)} &middot; ${formatRupiah(p.price)}</div>
            </td>
            <td class="col-price">${formatRupiah(p.price)}</td>
            <td class="col-stock"><span class="status-text ${getStockStatus(p.stock).cls}">${p.stock}</span></td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:24px;">No products in inventory yet.</td></tr>`;
    }

    // Critical Stock Alerts Table (Top 5)
    if (lowStockBody) {
      const lowStockAll = [...stokHabis, ...stokMenipis].slice(0, 5);
      lowStockBody.innerHTML = lowStockAll.length
        ? lowStockAll
            .map((p) => {
              const status = getStockStatus(p.stock);
              return `
          <tr onclick="window.location.href='product-detail.html?id=${p.id}'" style="cursor:pointer;">
            <td>
              <div style="font-weight:600;color:var(--color-text);">${escapeHtml(p.name)}</div>
              <small style="color:var(--color-text-muted);">${escapeHtml(p.code)}</small>
            </td>
            <td class="text-right"><span class="status-text ${status.cls}">${status.label} (${p.stock})</span></td>
          </tr>`;
            })
            .join("")
        : `<tr><td colspan="2" style="text-align:center;color:var(--color-text-muted);padding:24px;">All inventory stocks healthy</td></tr>`;
    }
  } catch (err) {
    console.error("Dashboard data load error:", err);
    showToast(translateError(err), "error");
  }
}

/**
 * Render Category Stock Bar Chart (Paired Products & Units with Separated Clear Labels)
 */
function renderCategoryBarChart(categoryMap) {
  const container = document.getElementById("bar-chart-container");
  if (!container) return;

  const categories = Object.keys(categoryMap || {});
  if (!categories.length) {
    container.innerHTML = `<div style="margin:auto;color:var(--color-text-muted);font-size:13px;">No category statistics available yet.</div>`;
    return;
  }

  // Sort by highest combined stock + count, display up to 6 categories
  const sortedCategories = categories
    .sort((a, b) => (categoryMap[b].stock + categoryMap[b].count) - (categoryMap[a].stock + categoryMap[a].count))
    .slice(0, 6);

  const maxStock = Math.max(...sortedCategories.map((c) => categoryMap[c].stock), 10);
  const maxCount = Math.max(...sortedCategories.map((c) => categoryMap[c].count), 5);

  container.innerHTML = sortedCategories
    .map((cat) => {
      const data = categoryMap[cat];
      const prodPct = Math.max(Math.round((data.count / maxCount) * 100), 12);
      const stockPct = Math.max(Math.round((data.stock / maxStock) * 100), 12);

      return `
      <div class="category-bar-group" title="${escapeHtml(cat)}: ${data.count} Products, ${data.stock} Units">
        <div class="category-bars-pair">
          <!-- Products Bar (Blue) -->
          <div class="cat-bar-track" title="${escapeHtml(cat)} — ${data.count} Products">
            <span class="cat-bar-val">${data.count}</span>
            <div class="cat-bar-fill bar-blue" style="height:${prodPct}%;"></div>
          </div>
          <!-- Units Bar (Purple) -->
          <div class="cat-bar-track" title="${escapeHtml(cat)} — ${data.stock} Units">
            <span class="cat-bar-val">${data.stock}</span>
            <div class="cat-bar-fill bar-purple" style="height:${stockPct}%;"></div>
          </div>
        </div>

        <!-- Clearly separated label below the baseline (no overlap) -->
        <div class="category-label-wrap">
          <span class="category-name-label" title="${escapeHtml(cat)}">${escapeHtml(cat)}</span>
          <span class="category-sub-stats">${data.stock} units</span>
        </div>
      </div>`;
    })
    .join("");
}

/**
 * Render Stock Health Donut Chart (SVG)
 */
function renderStockHealthDonut(safeCount, lowCount, outCount, total) {
  const totalEl = document.getElementById("donut-total-count");
  const safeEl = document.getElementById("donut-safe-count");
  const lowEl = document.getElementById("donut-low-count");
  const outEl = document.getElementById("donut-out-count");

  const sliceSafe = document.getElementById("donut-slice-safe");
  const sliceLow = document.getElementById("donut-slice-low");
  const sliceOut = document.getElementById("donut-slice-out");

  if (totalEl) totalEl.textContent = total;
  if (safeEl) safeEl.textContent = safeCount;
  if (lowEl) lowEl.textContent = lowCount;
  if (outEl) outEl.textContent = outCount;

  if (!total) {
    if (sliceSafe) sliceSafe.setAttribute("stroke-dasharray", "0 100");
    if (sliceLow) sliceLow.setAttribute("stroke-dasharray", "0 100");
    if (sliceOut) sliceOut.setAttribute("stroke-dasharray", "0 100");
    return;
  }

  const safePct = Math.round((safeCount / total) * 100);
  const lowPct = Math.round((lowCount / total) * 100);
  const outPct = Math.max(0, 100 - safePct - lowPct);

  // SVG circumference: stroke-dasharray="percentage, 100"
  if (sliceSafe) {
    sliceSafe.setAttribute("stroke-dasharray", `${safePct} 100`);
    sliceSafe.setAttribute("stroke-dashoffset", "0");
  }
  if (sliceLow) {
    sliceLow.setAttribute("stroke-dasharray", `${lowPct} 100`);
    sliceLow.setAttribute("stroke-dashoffset", `-${safePct}`);
  }
  if (sliceOut) {
    sliceOut.setAttribute("stroke-dasharray", `${outPct} 100`);
    sliceOut.setAttribute("stroke-dashoffset", `-${safePct + lowPct}`);
  }
}

/* ==========================================================================
   DYNAMIC DASHBOARD GREETING ENGINE
   Displays time-aware salutations ("Good morning", "Good afternoon",
   "Good evening", and occasionally "Hello") paired with the user's username.
   Rotates through friendly inventory check-in prompts on every visit,
   page refresh, login, or navigation.
   ========================================================================== */

const INVENTORY_GREETING_PROMPTS = [
  "What would you like to log today?",
  "Ready to add an item? What are we logging?",
  "What do you need to record today?",
  "Quick check-in: what are you adding to inventory?",
  "Need to log or track an item?",
  "What stock are we updating today?",
];

function getTimeSalute(seed) {
  // Occasionally greet with "Hello" (~1 in 3 visits)
  if (seed % 3 === 0) {
    return "Hello";
  }
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

function initDynamicGreeting() {
  const saluteEl = document.getElementById("welcome-salute");
  const subGreetingEl = document.getElementById("welcome-sub-greeting");

  // Read previous seed and advance it for this refresh / page visit / login
  const storedSeed = sessionStorage.getItem("invenza_greeting_seed");
  let nextSeed;
  if (storedSeed === null) {
    nextSeed = Math.floor(Math.random() * INVENTORY_GREETING_PROMPTS.length);
  } else {
    nextSeed = (parseInt(storedSeed, 10) + 1) % INVENTORY_GREETING_PROMPTS.length;
  }
  sessionStorage.setItem("invenza_greeting_seed", String(nextSeed));

  const salutation = getTimeSalute(nextSeed);
  const promptText = INVENTORY_GREETING_PROMPTS[nextSeed];

  if (saluteEl) saluteEl.textContent = salutation;
  if (subGreetingEl) {
    subGreetingEl.textContent = promptText;
  }
}

