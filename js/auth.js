/* ==========================================================================
   INVENZA — Auth Guard & User Session (English Standard)
   Protects authenticated pages, handles real-time auth changes,
   user profile loading, and logout workflow.
   ========================================================================== */

let currentSession = null;
let currentProfile = null;

/**
 * Required on protected pages.
 * Redirects to login.html if session is invalid.
 */
async function requireAuth() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data || !data.session) {
    window.location.replace("login.html");
    return null;
  }

  currentSession = data.session;

  // Listen to auth state changes (e.g. token expired, signout from another tab)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      window.location.replace("login.html");
    } else {
      currentSession = session;
    }
  });

  return currentSession;
}

/**
 * Get current authenticated user ID.
 * Features automatic offline fallback to local cached session.
 */
async function getCurrentUserId() {
  try {
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser();

    if (user && !error) {
      return user.id;
    }
  } catch (err) {
    console.warn("Online user verification skipped, using local session:", err);
  }

  if (currentSession && currentSession.user && currentSession.user.id) {
    return currentSession.user.id;
  }

  try {
    const { data } = await supabaseClient.auth.getSession();
    if (data && data.session && data.session.user) {
      currentSession = data.session;
      return data.session.user.id;
    }
  } catch (err) {
    console.warn("Failed to retrieve local session:", err);
  }

  window.location.replace("login.html");
  return null;
}

/**
 * Load user profile from public.profiles table.
 */
async function loadCurrentProfile() {
  if (!currentSession) return null;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentSession.user.id)
    .single();

  if (error) {
    console.warn("Profile fetch fallback:", error.message);
    currentProfile = {
      full_name: currentSession.user.user_metadata?.full_name || currentSession.user.email,
      email: currentSession.user.email,
    };
  } else {
    currentProfile = data;
  }
  return currentProfile;
}

/**
 * Redirect user if already logged in (used on login / signup pages).
 */
async function redirectIfLoggedIn(destination = "dashboard.html") {
  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session) {
    window.location.replace(destination);
    return true;
  }
  return false;
}

/**
 * Handle user sign out with confirmation modal.
 */
async function handleLogout() {
  const confirmed = await confirmDialog({
    title: "Sign Out",
    message: "Are you sure you want to sign out of Invenza?",
    confirmText: "Sign Out",
    cancelText: "Cancel",
    danger: true,
  });
  if (!confirmed) return;

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast(translateError(error), "error");
    return;
  }
  window.location.replace("login.html");
}

/**
 * Get formatted display name (prioritizing username).
 */
function getDisplayName(profile) {
  if (!profile && !currentSession?.user) return "User";
  const userMeta = currentSession?.user?.user_metadata;
  const username = (profile && profile.username && profile.username.trim()) ||
                   (userMeta && userMeta.username && userMeta.username.trim());
  if (username) return username;

  const fullName = (profile && profile.full_name && profile.full_name.trim()) ||
                   (userMeta && userMeta.full_name && userMeta.full_name.trim());
  if (fullName) return fullName;

  const email = (profile && profile.email) || currentSession?.user?.email;
  if (email) return email.split("@")[0];

  return "User";
}

/**
 * Render avatar image or initial fallback into an element.
 */
function renderAvatarInto(el, profile, fallbackName) {
  if (!el) return;
  const url = profile && profile.avatar_url;
  const name = fallbackName || getDisplayName(profile);
  const initial = name.trim().charAt(0).toUpperCase();
  if (url) {
    el.innerHTML = `<img src="${escapeHtml(url)}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    const img = el.querySelector("img");
    if (img) {
      img.addEventListener("error", () => {
        el.textContent = initial;
      });
    }
  } else {
    el.textContent = initial;
  }
}

/**
 * Initialize navbar & sidebar user widgets and event listeners.
 */
function initUserNavbar() {
  const name = currentProfile ? getDisplayName(currentProfile) : "User";

  // Topbar
  const topbarName = document.getElementById("navbar-user-name");
  const topbarAvatar = document.getElementById("navbar-user-avatar");
  if (topbarName) topbarName.textContent = name;
  if (topbarAvatar) renderAvatarInto(topbarAvatar, currentProfile, name);

  // Sidebar User Card (Inspired by Purple Dashboard)
  const sidebarName = document.getElementById("sidebar-user-name");
  const sidebarAvatar = document.getElementById("sidebar-user-avatar");
  if (sidebarName) sidebarName.textContent = name;
  if (sidebarAvatar) renderAvatarInto(sidebarAvatar, currentProfile, name);

  // Welcome Banner (if on dashboard)
  const welcomeName = document.getElementById("welcome-name");
  if (welcomeName) welcomeName.textContent = name;

  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  // Mobile sidebar drawer
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.add("open");
      overlay.classList.add("show");
    });
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    });
    sidebar.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
      });
    });
  }
}
