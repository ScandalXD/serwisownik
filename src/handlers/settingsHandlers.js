import { auth } from '../firebase.js';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile, deleteUser } from 'firebase/auth';
import { showNotification, clearFieldErrors, showFieldError, showConfirm } from '../uiUtils.js';
import { validatePassword } from '../validators.js';
// Dodany import naszej nowej funkcji eksportującej
import { exportUserData } from '../services/authService.js'; 

export function initSettingsHandlers() {
  
  // Profil
  const btnUpdateProfile = document.getElementById('btn-update-profile');
  if (btnUpdateProfile) {
    const settingsBtn = document.getElementById('btn-go-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        const user = auth.currentUser;
        if (user) {
          document.getElementById('set-display-name').value = user.displayName || '';
        }
      });
    }

    btnUpdateProfile.onclick = async () => {
      const nameInput = document.getElementById('set-display-name');
      const newName = nameInput.value.trim();
      const user = auth.currentUser;

      if (!user) return;

      try {
        btnUpdateProfile.disabled = true;
        btnUpdateProfile.innerText = "Zapisywanie...";
        
        await updateProfile(user, { displayName: newName });
        showNotification("Zaktualizowano profil!", "success");
      } catch (error) {
        showNotification("Błąd: " + error.message, "error");
      } finally {
        btnUpdateProfile.disabled = false;
        btnUpdateProfile.innerText = "Zapisz imię";
      }
    };
  }

  // Zmiana hasła ze sprawdzaniem
  const btnChange = document.getElementById('btn-change-password');
  const currentPassEl = document.getElementById('set-current-password');
  const newPassEl = document.getElementById('set-new-password');
  const confirmPassEl = document.getElementById('set-new-password-confirm');

  // Elementy listy wymogów z HTML
  const setReqLength = document.getElementById('set-req-length');
  const setReqUpper = document.getElementById('set-req-upper');
  const setReqNumber = document.getElementById('set-req-number');
  const setReqSpecial = document.getElementById('set-req-special');

  if (newPassEl && setReqLength) {
    const checkSettingsPasswordStrength = () => {
      const pswd = newPassEl.value;

      // Walidacja nowego hasła na żywo
      const isLengthValid = pswd.length >= 8;
      const isUpperValid = /[A-Z]/.test(pswd);
      const isNumberValid = /[0-9]/.test(pswd);
      const isSpecialValid = /[^A-Za-z0-9]/.test(pswd);

      setReqLength.classList.toggle('valid', isLengthValid);
      setReqUpper.classList.toggle('valid', isUpperValid);
      setReqNumber.classList.toggle('valid', isNumberValid);
      setReqSpecial.classList.toggle('valid', isSpecialValid);
      
    };

    newPassEl.addEventListener('input', checkSettingsPasswordStrength);
  }

  if (btnChange) {
    btnChange.onclick = async () => {
      clearFieldErrors('view-settings');
      let isValid = true;

      const currentPass = currentPassEl.value;
      const newPass = newPassEl.value;
      const confirmPass = confirmPassEl.value;

      if (!currentPass) {
        showFieldError(currentPassEl, "Podaj aktualne hasło.");
        isValid = false;
      }

      try {
        validatePassword(newPass);
      } catch (e) {
        showFieldError(newPassEl, e.message);
        isValid = false;
      }

      if (newPass !== confirmPass) { 
        showFieldError(confirmPassEl, "Hasła nie są identyczne."); 
        isValid = false; 
      }

      if (!isValid) return;

      try {
        btnChange.disabled = true;
        btnChange.innerText = "Zmienianie...";

        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(user.email, currentPass);
        
        await reauthenticateWithCredential(user, credential);

        await updatePassword(user, newPass);

        showNotification("Hasło zostało zmienione!", "success");
        currentPassEl.value = ''; 
        newPassEl.value = ''; 
        confirmPassEl.value = '';

        // Resetowanie wizualne wymogów
        if (setReqLength) {
          setReqLength.classList.remove('valid');
          setReqUpper.classList.remove('valid');
          setReqNumber.classList.remove('valid');
          setReqSpecial.classList.remove('valid');
        }

      } catch (error) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
          showFieldError(currentPassEl, "Błędne aktualne hasło.");
        } else {
          showNotification("Wystąpił błąd podczas zmiany hasła.", "error");
        }
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
      showConfirm("Czy na pewno chcesz usunąć konto? Ta operacja jest nieodwracalna, stracisz wszystkie wpisy w garażu.", async () => {
        try {
          const user = auth.currentUser;
          if (user) {
            await deleteUser(user);
            showNotification("Konto zostało usunięte.", "info");
          }
        } catch (error) {
          if (error.code === 'auth/requires-recent-login') {
             showNotification("Ze względów bezpieczeństwa wyloguj się, zaloguj ponownie i spróbuj usunąć konto.", "error");
          } else {
             showNotification("Błąd: " + error.message, "error");
          }
        }
      });
    };
  }

  // Pobieranie danych konta
  const btnExportData = document.getElementById('btn-export-data');
  if (btnExportData) {
    btnExportData.onclick = async () => {
      try {
        btnExportData.disabled = true;
        btnExportData.innerText = "Przygotowywanie pliku...";

        const res = await exportUserData();

        if (res.ok) {
          showNotification("Pomyślnie pobrano kopię danych konta.", "success");
        } else {
          showNotification("Wystąpił problem z pobraniem danych.", "error");
        }
      } catch (error) {
        showNotification("Błąd: " + error.message, "error");
      } finally {
        btnExportData.disabled = false;
        btnExportData.innerText = "Pobierz kopię danych";
      }
    };
  }

}