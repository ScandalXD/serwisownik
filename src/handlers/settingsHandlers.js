import { auth } from '../firebase.js';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile, deleteUser } from 'firebase/auth';
import { showNotification, clearFieldErrors, showFieldError, showConfirm } from '../uiUtils.js';
import { validatePassword } from '../validators.js';
import { exportUserData } from '../services/authService.js'; 

// Obsługa błędów
function getFriendlyError(error) {
  const code = String(error.code || "").toLowerCase();
  
  if (!navigator.onLine || code.includes('network-request-failed')) {
    return 'Brak połączenia z internetem.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Podane hasło jest nieprawidłowe.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Ze względów bezpieczeństwa wyloguj się i zaloguj ponownie.';
  }
  return `Wystąpił błąd: ${error.message || 'Nieznany problem'}`;
}

export function initSettingsHandlers() {
  
  // Profil
  const btnUpdateProfile = document.getElementById('btn-update-profile');
  const settingsBtn = document.getElementById('btn-go-settings');
  const nameInput = document.getElementById('set-display-name');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const user = auth.currentUser;
      if (user && nameInput) nameInput.value = user.displayName || '';
    });
  }

  if (btnUpdateProfile && nameInput) {
    btnUpdateProfile.onclick = async () => {
      if (!navigator.onLine) {
        showNotification(getFriendlyError({code: 'network-request-failed'}), "error");
        return;
      }
      
      const newName = nameInput.value.trim();
      const user = auth.currentUser;
      if (!user) return;

      try {
        btnUpdateProfile.disabled = true;
        btnUpdateProfile.innerText = "Zapisywanie...";
        await updateProfile(user, { displayName: newName });
        showNotification("Zaktualizowano profil", "success");
      } catch (error) {
        showNotification(getFriendlyError(error), "error");
      } finally {
        btnUpdateProfile.disabled = false;
        btnUpdateProfile.innerText = "Zapisz imię";
      }
    };
  }

  // Zmiana hasła
  const btnChange = document.getElementById('btn-change-password');
  const currentPassEl = document.getElementById('set-current-password');
  const newPassEl = document.getElementById('set-new-password');
  const confirmPassEl = document.getElementById('set-new-password-confirm');

  if (btnChange && currentPassEl && newPassEl && confirmPassEl) {
    btnChange.onclick = async () => {
      if (!navigator.onLine) {
        showNotification(getFriendlyError({code: 'network-request-failed'}), "error");
        return;
      }

      clearFieldErrors('view-settings');
      let isValid = true;

      if (!currentPassEl.value) { showFieldError(currentPassEl, "Podaj aktualne hasło."); isValid = false; }
      try { validatePassword(newPassEl.value); } catch (e) { showFieldError(newPassEl, e.message); isValid = false; }
      if (newPassEl.value !== confirmPassEl.value) { showFieldError(confirmPassEl, "Hasła nie są identyczne."); isValid = false; }

      if (!isValid) return;

      try {
        btnChange.disabled = true;
        btnChange.innerText = "Zmienianie...";
        const user = auth.currentUser;
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassEl.value));
        await updatePassword(user, newPassEl.value);

        showNotification("Hasło zostało zmienione", "success");
        currentPassEl.value = newPassEl.value = confirmPassEl.value = '';
      } catch (error) {
        showNotification(getFriendlyError(error), "error");
      } finally {
        btnChange.disabled = false; 
        btnChange.innerText = "Zmień hasło";
      }
    };
  }

  // Usuwanie konta
  const btnDeleteAccount = document.getElementById('btn-delete-account');
  if (btnDeleteAccount) {
    btnDeleteAccount.onclick = () => {
      if (!navigator.onLine) {
        showNotification(getFriendlyError({code: 'network-request-failed'}), "error");
        return;
      }
      showConfirm("Czy na pewno usunąć konto? To nieodwracalne.", async () => {
        try {
          await deleteUser(auth.currentUser);
          showNotification("Konto usunięte.", "info");
        } catch (error) {
          showNotification(getFriendlyError(error), "error");
        }
      });
    };
  }

  // Eksport danych
  const btnExportData = document.getElementById('btn-export-data');
  if (btnExportData) {
    btnExportData.onclick = async () => {
      if (!navigator.onLine) {
        showNotification(getFriendlyError({code: 'network-request-failed'}), "error");
        return;
      }
      try {
        btnExportData.disabled = true;
        const res = await exportUserData();
        if (res.ok) showNotification("Pomyślnie pobrano dane.", "success");
        else showNotification(getFriendlyError(res.error), "error");
      } catch (error) {
        showNotification(getFriendlyError(error), "error");
      } finally {
        btnExportData.disabled = false;
      }
    };
  }
}
