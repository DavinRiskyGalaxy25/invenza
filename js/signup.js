/* ==========================================================================
   INVENZA — Sign Up Page Logic
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initPasswordToggles();
  await redirectIfLoggedIn("dashboard.html");

  const form = document.getElementById("signup-form");
  const alertBox = document.getElementById("signup-alert");
  const submitBtn = document.getElementById("signup-submit");

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

      const name = document.getElementById("signup-name").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;
      const confirmPassword = document.getElementById("signup-confirm-password").value;

      // Validation
      if (!name) return showAlert("Full name is required.");
      if (name.length < 3) return showAlert("Name must be at least 3 characters.");
      if (!email) return showAlert("Email address is required.");
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return showAlert("Please enter a valid email address.");
      if (!password || password.length < 6) return showAlert("Password must be at least 6 characters.");
      if (password !== confirmPassword) return showAlert("Passwords do not match.");

      setButtonLoading(submitBtn, true, "Creating Account...");

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        });

        setButtonLoading(submitBtn, false);

        if (error) {
          console.error("Sign up error:", error);
          showAlert(translateError(error));
          return;
        }

        if (!data || !data.user) {
          showAlert("Registration failed. Please try again.");
          return;
        }

        form.reset();

        if (data.session) {
          showAlert("Account created successfully. Redirecting to dashboard...", "success");
          setTimeout(() => window.location.replace("dashboard.html"), 1200);
        } else {
          showAlert("Account created successfully. Redirecting to sign in...", "success");
          setTimeout(() => window.location.replace("login.html?registered=1"), 1500);
        }
      } catch (err) {
        console.error("Unexpected sign up error:", err);
        setButtonLoading(submitBtn, false);
        showAlert(translateError(err));
      }
    });
  }
});
