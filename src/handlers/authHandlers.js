import { login, register, logout } from '../services/authService.js';
import { validateEmail, validatePassword } from '../validators.js';
import { showView, clearInputs } from '../uiUtils.js';
import { loadVehicles } from './vehicleHandlers.js';
import { checkNotifications } from './notificationHandlers.js';

export function initAuthHandlers() {
  
  // Logowanie do aplikacji
  document.getElementById('btn-login').onclick = async () => {
    try {
      const e = document.getElementById('email').value;
      const p = document.getElementById('password').value;

      validateEmail(e);
      validatePassword(p);

      const res = await login(e, p);
      
      if (res.ok) {
        clearInputs('view-auth'); 
        showView('view-dashboard');
        loadVehicles();
        checkNotifications();
      } else {
        alert("Błąd logowania: " + res.error.message);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  // Rejestracja nowego konta
  document.getElementById('btn-register').onclick = async () => {
    try {
      const e = document.getElementById('email').value;
      const p = document.getElementById('password').value;

      validateEmail(e);
      validatePassword(p);

      const res = await register(e, p);
      
      if (res.ok) {
        alert("Konto zostało utworzone pomyślnie! Możesz się teraz zalogować.");
      } else {
        alert("Błąd rejestracji: " + res.error.message);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  // Wylogowanie i powrót do ekranu startowego
  document.getElementById('btn-logout').onclick = async () => {
    if (confirm("Czy na pewno chcesz się wylogować z aplikacji?")) {
      await logout();
      clearInputs('view-auth');
      showView('view-auth');
    }
  };
}