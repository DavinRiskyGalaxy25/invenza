/* ==========================================================================
   INVENZA — Reset Password Page Logic
   Supports two modes:
   1. REQUEST mode: user inputs email to receive password reset link.
   2. UPDATE mode: user arrives from Supabase recovery email link.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initPasswordToggles();

  const requestSection = document.getElementById("request-section");
  const updateSection = document.getElementById("update-section");

  const requestForm = document.getElementById("request-form");
  const requestAlert = document.getElementById("request-alert");
  const requestSubmit = document.getElementById("request-submit");

  const updateForm = document.getElementById("update-form");
  const updateAlert = document.getElementById("update-alert");
  const updateSubmit = document.getElementById("update-submit");

  function showAlert(box, message, type = "error") {
    box.textContent = message;
    box.className = `auth-alert show ${type}`;
  }

  // Supabase triggers PASSWORD_RECOVERY when user opens recovery link from email
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      requestSection.classList.add("hidden");
      updateSection.classList.remove("hidden");
    }
  });

  if (window.location.hash.includes("type=recovery")) {
    requestSection.classList.add("hidden");
    updateSection.classList.remove("hidden");
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (requestForm) {
    requestForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("reset-email").value.trim();

      if (!email) return showAlert(requestAlert, "Email address is required.");
      if (!EMAIL_REGEX.test(email)) return showAlert(requestAlert, "Please enter a valid email address.");

      setButtonLoading(requestSubmit, true, "Sending...");

      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      setButtonLoading(requestSubmit, false);

      if (error && !isTransientAuthError(error)) {
        showAlert(requestAlert, translateError(error));
        return;
      }

      showAlert(
        requestAlert,
        "If this email is registered, password reset instructions have been sent. Please check your inbox and spam folder.",
        "success"
      );
      requestForm.reset();
    });
  }

  function isTransientAuthError(error) {
    const msg = ((error && error.message) || "").toLowerCase();
    return msg.includes("user not found") || msg.includes("not found");
  }

  if (updateForm) {
    updateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-new-password").value;

      if (!newPassword || newPassword.length < 6) {
        return showAlert(updateAlert, "Password must be at least 6 characters.");
      }
      if (newPassword !== confirmPassword) {
        return showAlert(updateAlert, "Passwords do not match.");
      }

      setButtonLoading(updateSubmit, true, "Saving...");

      const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

      setButtonLoading(updateSubmit, false);

      if (error) {
        showAlert(updateAlert, translateError(error));
        return;
      }

      showAlert(updateAlert, "Password updated successfully. Redirecting to sign in...", "success");
      setTimeout(() => window.location.replace("login.html"), 1500);
    });
  }
});
