/* ==========================================================================
   INVENZA — Login Page Logic
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initPasswordToggles();

  // If already logged in, redirect straight to dashboard
  await redirectIfLoggedIn("dashboard.html");

  const form = document.getElementById("login-form");
  const alertBoxInit = document.getElementById("login-alert");

  if (getQueryParam("registered") === "1" && alertBoxInit) {
    alertBoxInit.textContent = "Account created successfully. Please sign in.";
    alertBoxInit.className = "auth-alert show success";
  }

  const alertBox = document.getElementById("login-alert");
  const submitBtn = document.getElementById("login-submit");

  function showAlert(message, type = "error") {
    alertBox.textContent = message;
    alertBox.className = `auth-alert show ${type}`;
  }
  function hideAlert() {
    alertBox.className = "auth-alert";
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert();

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      if (!email) return showAlert("Email address is required.");
      if (!password) return showAlert("Password is required.");

      setButtonLoading(submitBtn, true, "Signing in...");

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        setButtonLoading(submitBtn, false);

        if (error) {
          console.error("Login error:", error);
          showAlert(translateError(error));
          return;
        }

        if (data && data.session) {
          window.location.replace("dashboard.html");
        } else {
          showAlert("Sign in failed. Please check your credentials.");
        }
      } catch (err) {
        console.error("Unexpected login error:", err);
        setButtonLoading(submitBtn, false);
        showAlert(translateError(err));
      }
    });
  }
});
