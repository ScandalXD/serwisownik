import { login, register, logout } from '../services/authService.js';
import { validateEmail, validatePassword } from '../validators.js';
import { showView, clearInputs, showNotification, showConfirm, showFieldError, clearFieldErrors } from '../uiUtils.js';

// Tłumaczenie błędów z Firebase
function getPolishAuthError(error) {

  const errorCode = String(error.code || error.message || "").toLowerCase();

  if (errorCode.includes('invalid-credential') || 
      errorCode.includes('user-not-found') || 
      errorCode.includes('wrong-password') ||
      errorCode.includes('invalid-password') ||
      errorCode.includes('invalid-login')) {
    return 'Nieprawidłowy adres e-mail lub hasło.';
  }
  if (errorCode.includes('email-already-in-use')) {
    return 'Konto z tym adresem e-mail już istnieje.';
  }
  if (errorCode.includes('weak-password')) {
    return 'Hasło jest zbyt słabe.';
  }
  if (errorCode.includes('invalid-email')) {
    return 'Nieprawidłowy format adresu e-mail.';
  }
  if (errorCode.includes('too-many-requests')) {
    return 'Zbyt wiele nieudanych prób logowania. Spróbuj później.';
  }
  
  return `Wystąpił nieoczekiwany błąd. (${error.code || 'Nieznany błąd'})`;
}

export function initAuthHandlers() {
  
  // Przełączanie widoków
  document.getElementById('btn-go-register').onclick = () => {
    clearFieldErrors('view-login');
    clearInputs('view-login'); 
    showView('view-register');
  };

  document.getElementById('btn-go-login').onclick = () => {
    clearFieldErrors('view-register');
    clearInputs('view-register');
    showView('view-login');
  };

  // Sprawdzanie hasła na żywo
  const regPasswordInput = document.getElementById('reg-password');
  const reqLength = document.getElementById('req-length');
  const reqUpper = document.getElementById('req-upper');
  const reqNumber = document.getElementById('req-number');
  const reqSpecial = document.getElementById('req-special');

  const checkPasswordStrength = () => {
    if (!regPasswordInput) return;

    const pswd = regPasswordInput.value;

    const isLengthValid = pswd.length >= 8;
    const isUpperValid = /[A-Z]/.test(pswd);
    const isNumberValid = /[0-9]/.test(pswd);
    const isSpecialValid = /[^A-Za-z0-9]/.test(pswd);

    if (reqLength) {
      reqLength.classList.toggle('valid', isLengthValid);
      reqUpper.classList.toggle('valid', isUpperValid);
      reqNumber.classList.toggle('valid', isNumberValid);
      reqSpecial.classList.toggle('valid', isSpecialValid);
    }
  };

  if (regPasswordInput && reqLength) {
    regPasswordInput.addEventListener('input', checkPasswordStrength);
  }

  // Logowanie
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.onclick = async () => {
      const emailIn = document.getElementById('login-email');
      const passIn = document.getElementById('login-password');

      clearFieldErrors('view-login');
      let isValid = true;

      if (!emailIn.value.trim()) { 
        showFieldError(emailIn, "Podaj adres e-mail."); 
        isValid = false; 
      } else {
        try { validateEmail(emailIn.value); } catch(e) { showFieldError(emailIn, e.message); isValid = false; }
      }
      
      if (!passIn.value.trim()) {
        showFieldError(passIn, "Hasło jest wymagane.");
        isValid = false; 
      }

      if (!isValid) return; 

      try {
        btnLogin.disabled = true; 
        btnLogin.innerText = "Logowanie...";

        const res = await login(emailIn.value, passIn.value);
        if (res.ok) {
          clearInputs('view-login'); 
        } else {
          showNotification(getPolishAuthError(res.error), "error");
        }
      } catch (error) {
        showNotification("Wystąpił błąd połączenia.", "error");
      } finally {
        btnLogin.disabled = false; 
        btnLogin.innerText = "Zaloguj się";
      }
    };
  }

  // Rejestracja
  const btnRegister = document.getElementById('btn-register');
  if (btnRegister) {
    btnRegister.onclick = async () => {
      const emailIn = document.getElementById('reg-email');
      const passIn = document.getElementById('reg-password');
      const passConfirmIn = document.getElementById('reg-password-confirm');

      clearFieldErrors('view-register');
      let isValid = true;

      if (!emailIn.value.trim()) { 
        showFieldError(emailIn, "Podaj adres e-mail."); 
        isValid = false; 
      } else {
        try { validateEmail(emailIn.value); } catch(e) { showFieldError(emailIn, e.message); isValid = false; }
      }

      try { validatePassword(passIn.value); } catch(e) { showFieldError(passIn, e.message); isValid = false; }

      if (passIn.value !== passConfirmIn.value) {
        showFieldError(passConfirmIn, "Hasła nie są identyczne.");
        isValid = false;
      }

      if (!isValid) return;

      try {
        btnRegister.disabled = true; 
        btnRegister.innerText = "Rejestracja...";

        const res = await register(emailIn.value, passIn.value);
        if (res.ok) {
          showNotification("Konto utworzone pomyślnie", "success");
          clearInputs('view-register');
          
          if (reqLength) {
             reqLength.classList.remove('valid');
             reqUpper.classList.remove('valid');
             reqNumber.classList.remove('valid');
             reqSpecial.classList.remove('valid');
          }
        } else {
          showNotification(getPolishAuthError(res.error), "error");
        }
      } catch (error) {
        showNotification("Wystąpił błąd połączenia.", "error");
      } finally {
        btnRegister.disabled = false;
        btnRegister.innerText = "Zarejestruj się";
      }
    };
  }

  // Wylogowanie
  const logoutBtn = document.getElementById('btn-logout');
  if(logoutBtn) {
    logoutBtn.onclick = async () => {
      showConfirm("Czy na pewno chcesz się wylogować?", async () => {
        await logout();
        showView('view-login');
      });
    };
  }
}
