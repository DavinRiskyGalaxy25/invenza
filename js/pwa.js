/* ==========================================================================
   INVENZA — PWA Installation System (English Standard)
   Controls all install triggers with attribute [data-pwa-install]:
     - "sidebar": primary action in navigation drawer
     - "topbar" : compact button for mobile headers
     - "auth"   : prompt on public login / register cards
   ========================================================================== */

(function () {
  let deferredPrompt = null;
  let currentState = "manual";
  const FLAG = "invenza_pwa_appinstalled";

  const isStandalone = () =>
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;

  const isSecureEnv = () =>
    window.isSecureContext ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

  function detectPlatform() {
    const ua = navigator.userAgent || "";
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
    const isAndroid = /android/i.test(ua);
    const isFirefox = /firefox|fxios/i.test(ua);
    if (isIOS) return "ios-safari";
    if (isAndroid && isFirefox) return "android-firefox";
    if (isAndroid) return "android-chrome";
    if (isFirefox) return "desktop-firefox";
    return "desktop-chromium";
  }

  const PLATFORM = detectPlatform();

  function manualHint() {
    switch (PLATFORM) {
      case "ios-safari":
        return 'In Safari: Tap the Share button (box with upward arrow), then select "Add to Home Screen".';
      case "android-firefox":
        return 'Open menu (⋮) in Firefox, then select "Install" or "Add to Home screen".';
      case "android-chrome":
        return 'Open menu (⋮) in Chrome, then select "Install app" or "Add to Home screen".';
      case "desktop-firefox":
        return "Firefox desktop does not support direct PWA prompt. You can pin this tab or bookmark the page.";
      default:
        return 'Click the install icon (⊕) in the browser address bar, or open menu (⋮) and select "Install Invenza".';
    }
  }

  function buttons() {
    return document.querySelectorAll("[data-pwa-install]");
  }

  function render(state) {
    currentState = state;
    buttons().forEach((btn) => {
      const isTopbar = btn.dataset.pwaInstall === "topbar";
      const isAuth = btn.dataset.pwaInstall === "auth";
      const icon = btn.querySelector(".pwa-icon");
      const label = btn.querySelector(".pwa-label");
      btn.dataset.pwaState = state;
      btn.disabled = false;
      btn.classList.remove("hidden", "sidebar-pwa-installed");

      if (state === "installed") {
        if (isTopbar || isAuth) {
          btn.classList.add("hidden");
        } else {
          if (icon) icon.className = "bi bi-check-circle-fill pwa-icon";
          if (label) label.textContent = "App Installed";
          btn.disabled = true;
          btn.classList.add("sidebar-pwa-installed");
        }
      } else {
        if (icon) icon.className = "bi bi-download pwa-icon";
        if (label) label.textContent = isTopbar ? "Install" : (isAuth ? "Install App" : "Install App");
      }
    });
  }

  function showHint(message) {
    if (typeof showToast === "function") showToast(message, "info", 8000);
    else alert(message);
  }

  async function onClick() {
    if (currentState === "installed") return;

    if (deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem(FLAG, "1");
        render("installed");
      } else {
        render("manual");
      }
      return;
    }

    if (!isSecureEnv()) {
      showHint(
        "Application install requires a secure HTTPS connection (or localhost). Please visit Invenza via HTTPS to install."
      );
      return;
    }
    showHint(manualHint());
  }

  function init() {
    if (!buttons().length) return;

    if (isStandalone() || localStorage.getItem(FLAG) === "1") {
      render(isStandalone() ? "installed" : "manual");
    } else {
      render(isSecureEnv() ? "manual" : "insecure");
    }

    buttons().forEach((btn) => btn.addEventListener("click", onClick));

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      render("installable");
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      localStorage.setItem(FLAG, "1");
      render("installed");
      if (typeof showToast === "function") showToast("Invenza installed successfully!", "success");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
