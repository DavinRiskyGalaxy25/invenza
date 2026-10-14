/* ==========================================================================
   INVENZA — Profile Page Logic
   Handles: Account information display, Edit Profile (username, email, avatar),
   Change Password, and PWA integration.
   ========================================================================== */

let profileSelectedAvatarFile = null;
let profileRemoveAvatarFlag = false;

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth();
  if (!session) return;

  const profile = await loadCurrentProfile();
  initUserNavbar();
  initPasswordToggles();

  renderProfilePage(profile, session);
  bindEditProfileModal(session);
  bindChangePasswordModal();
});

/* ---------------------------------------------------------------------- */
/*  RENDER                                                                 */
/* ---------------------------------------------------------------------- */

function renderProfilePage(profile, session) {
  const email = session?.user?.email || profile?.email || "-";
  const name = getDisplayName(profile);

  const heroName = document.getElementById("profile-name-hero");
  if (heroName) heroName.textContent = name;

  const heroEmail = document.getElementById("profile-email-hero");
  if (heroEmail) heroEmail.textContent = email;

  renderAvatarInto(document.getElementById("profile-avatar-hero"), profile, name);

  const usernameEl = document.getElementById("info-username");
  if (usernameEl) {
    usernameEl.textContent = (profile && profile.username) ? profile.username : "Not set";
  }

  const emailEl = document.getElementById("info-email");
  if (emailEl) emailEl.textContent = email;

  const joinedEl = document.getElementById("info-joined");
  if (joinedEl) {
    joinedEl.textContent = profile && profile.created_at ? formatDate(profile.created_at) : "-";
  }
}

/* ---------------------------------------------------------------------- */
/*  EDIT PROFILE MODAL                                                     */
/* ---------------------------------------------------------------------- */

function bindEditProfileModal(session) {
  const modal = document.getElementById("edit-profile-modal");
  const openBtn = document.getElementById("open-edit-profile-btn");
  const form = document.getElementById("edit-profile-form");
  const fileInput = document.getElementById("avatar-file-input");
  const changePhotoBtn = document.getElementById("change-photo-btn");
  const removePhotoBtn = document.getElementById("remove-photo-btn");
  const preview = document.getElementById("avatar-picker-preview");

  if (!modal || !openBtn) return;

  openBtn.addEventListener("click", () => openEditProfileModal(session));
  modal.querySelectorAll("[data-close-modal]").forEach((btn) =>
    btn.addEventListener("click", () => closeEditProfileModal())
  );
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeEditProfileModal();
  });

  if (changePhotoBtn && fileInput) {
    changePhotoBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      const errorAvatar = document.getElementById("error-avatar");
      if (errorAvatar) errorAvatar.textContent = "";
      if (!file) return;

      const check = validateAvatarFile(file);
      if (!check.valid) {
        if (errorAvatar) errorAvatar.textContent = check.message;
        fileInput.value = "";
        return;
      }

      profileSelectedAvatarFile = file;
      profileRemoveAvatarFlag = false;

      const reader = new FileReader();
      reader.onload = (e) => {
        preview.innerHTML = `<img src="${e.target.result}" alt="Avatar Preview">`;
      };
      reader.readAsDataURL(file);
    });
  }

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener("click", () => {
      profileSelectedAvatarFile = null;
      profileRemoveAvatarFlag = true;
      if (fileInput) fileInput.value = "";
      preview.textContent = getDisplayName(currentProfile).trim().charAt(0).toUpperCase();
      const errorAvatar = document.getElementById("error-avatar");
      if (errorAvatar) errorAvatar.textContent = "";
    });
  }

  if (form) form.addEventListener("submit", (e) => handleEditProfileSubmit(e, session));
}

function openEditProfileModal(session) {
  profileSelectedAvatarFile = null;
  profileRemoveAvatarFlag = false;

  const usernameInput = document.getElementById("edit-username");
  if (usernameInput) usernameInput.value = (currentProfile && currentProfile.username) || "";

  const emailInput = document.getElementById("edit-email");
  if (emailInput) emailInput.value = session?.user?.email || "";

  const fileInput = document.getElementById("avatar-file-input");
  if (fileInput) fileInput.value = "";

  clearEditProfileErrors();

  const preview = document.getElementById("avatar-picker-preview");
  renderAvatarInto(preview, currentProfile, getDisplayName(currentProfile));

  const modal = document.getElementById("edit-profile-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeEditProfileModal() {
  const modal = document.getElementById("edit-profile-modal");
  if (modal) modal.classList.add("hidden");
}

function clearEditProfileErrors() {
  document.querySelectorAll("#edit-profile-form .form-error").forEach((el) => (el.textContent = ""));
}

async function handleEditProfileSubmit(e, session) {
  e.preventDefault();
  clearEditProfileErrors();

  const usernameRaw = document.getElementById("edit-username")?.value || "";
  const emailRaw = (document.getElementById("edit-email")?.value || "").trim();

  const usernameCheck = validateUsername(usernameRaw);
  if (!usernameCheck.valid) {
    const errorEl = document.getElementById("error-username");
    if (errorEl) errorEl.textContent = usernameCheck.message;
    return;
  }
  if (!emailRaw) {
    const errorEl = document.getElementById("error-email");
    if (errorEl) errorEl.textContent = "Email address is required.";
    return;
  }

  const submitBtn = document.getElementById("edit-profile-submit-btn");
  const originalBtnHtml = submitBtn.innerHTML;
  setButtonLoading(submitBtn, true, "Saving...");

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // 1. Update username
    const { error: usernameError } = await supabaseClient
      .from("profiles")
      .update({ username: usernameCheck.value, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (usernameError) {
      if (usernameError.code === "23505") {
        const errorEl = document.getElementById("error-username");
        if (errorEl) errorEl.textContent = "Username is already taken, please choose another.";
        return;
      }
      throw usernameError;
    }

    // 2. Avatar handling
    if (profileSelectedAvatarFile || profileRemoveAvatarFlag) {
      setButtonLoading(submitBtn, true, "Uploading photo...");
      try {
        await applyAvatarChange(userId, profileSelectedAvatarFile);
      } catch (avatarErr) {
        console.error(avatarErr);
        showToast(translateError(avatarErr), "error");
        return;
      }
    }

    // 3. Email update via auth
    let emailPending = false;
    if (emailRaw && session?.user?.email && emailRaw !== session.user.email) {
      setButtonLoading(submitBtn, true, "Saving...");
      const { error: emailError } = await supabaseClient.auth.updateUser({ email: emailRaw });
      if (emailError) {
        const errorEl = document.getElementById("error-email");
        if (errorEl) errorEl.textContent = translateError(emailError);
        return;
      }
      emailPending = true;
    }

    await loadCurrentProfile();
    initUserNavbar();
    renderProfilePage(currentProfile, { user: { email: emailPending ? session.user.email : emailRaw } });

    closeEditProfileModal();

    if (emailPending) {
      showToast("Email change requested. Please check your new inbox to confirm.", "info", 6000);
    } else {
      showToast("Profile updated successfully", "success");
    }
  } catch (err) {
    console.error(err);
    showToast(translateError(err), "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
  }
}

async function applyAvatarChange(userId, file) {
  const previousAvatarUrl = currentProfile && currentProfile.avatar_url;
  let newAvatarUrl = null;
  let newPath = null;

  if (file) {
    const check = validateAvatarFile(file);
    if (!check.valid) throw new Error(check.message);

    newPath = `${userId}/avatar-${Date.now()}.${check.ext}`;
    const { error: uploadError } = await supabaseClient.storage
      .from(PROFILE_IMAGE_BUCKET)
      .upload(newPath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const { data } = supabaseClient.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(newPath);
    newAvatarUrl = data.publicUrl;
  }

  const { error: dbError } = await supabaseClient
    .from("profiles")
    .update({ avatar_url: newAvatarUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (dbError) {
    if (newPath) {
      await supabaseClient.storage.from(PROFILE_IMAGE_BUCKET).remove([newPath]).catch(() => {});
    }
    throw dbError;
  }

  if (previousAvatarUrl) {
    try {
      const parts = previousAvatarUrl.split(`${PROFILE_IMAGE_BUCKET}/`);
      if (parts.length >= 2) {
        const oldPath = decodeURIComponent(parts[1]);
        if (oldPath !== newPath) {
          await supabaseClient.storage.from(PROFILE_IMAGE_BUCKET).remove([oldPath]);
        }
      }
    } catch (cleanupErr) {
      console.warn("Failed to delete obsolete avatar image:", cleanupErr);
    }
  }
}

/* ---------------------------------------------------------------------- */
/*  CHANGE PASSWORD MODAL                                                  */
/* ---------------------------------------------------------------------- */

function bindChangePasswordModal() {
  const modal = document.getElementById("change-password-modal");
  const openBtn = document.getElementById("open-change-password-btn");
  const form = document.getElementById("change-password-form");

  if (!modal || !openBtn) return;

  openBtn.addEventListener("click", () => {
    if (form) form.reset();
    clearChangePasswordErrors();
    modal.classList.remove("hidden");
  });

  modal.querySelectorAll("[data-close-modal]").forEach((btn) =>
    btn.addEventListener("click", () => modal.classList.add("hidden"))
  );
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  if (form) form.addEventListener("submit", handleChangePasswordSubmit);
}

function clearChangePasswordErrors() {
  document.querySelectorAll("#change-password-form .form-error").forEach((el) => (el.textContent = ""));
}

async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  clearChangePasswordErrors();

  const newPassword = document.getElementById("new-password")?.value;
  const confirmPassword = document.getElementById("confirm-new-password")?.value;

  if (!newPassword || newPassword.length < 6) {
    const errorEl = document.getElementById("error-new-password");
    if (errorEl) errorEl.textContent = "Password must be at least 6 characters.";
    return;
  }
  if (newPassword !== confirmPassword) {
    const errorEl = document.getElementById("error-confirm-password");
    if (errorEl) errorEl.textContent = "Passwords do not match.";
    return;
  }

  const submitBtn = document.getElementById("change-password-submit-btn");
  setButtonLoading(submitBtn, true, "Updating...");

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;

    showToast("Password updated successfully", "success");
    const modal = document.getElementById("change-password-modal");
    if (modal) modal.classList.add("hidden");
    const form = document.getElementById("change-password-form");
    if (form) form.reset();
  } catch (err) {
    console.error(err);
    const errorEl = document.getElementById("error-new-password");
    if (errorEl) errorEl.textContent = translateError(err);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}
