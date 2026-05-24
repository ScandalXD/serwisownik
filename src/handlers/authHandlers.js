import { login, register, logout } from '../services/authService.js';
import { validateEmail, validatePassword } from '../validators.js';
import { showView, clearInputs, confirmAction } from '../uiUtils.js';
import { loadVehicles } from './vehicleHandlers.js';
import { checkNotifications } from './notificationHandlers.js';
import {
  showFormError,
  showFormSuccess,
  clearFormErrors
} from '../errors.js';

const AUTH_FIELDS = {
  email: 'email',
  password: 'password'
};

export function initAuthHandlers() {
  document.getElementById('btn-login').onclick = async () => {
    const containerId = 'view-auth';

    try {
      clearFormErrors(containerId);

      const e = document.getElementById('email').value;
      const p = document.getElementById('password').value;

      const email = validateEmail(e);
      const password = validatePassword(p);

      const res = await login(email, password);

      if (res.ok) {
        clearInputs(containerId);
        showView('view-dashboard');
        loadVehicles();
        checkNotifications();
      } else {
        showFormError(containerId, res.error, AUTH_FIELDS);
      }
    } catch (error) {
      showFormError(containerId, error, AUTH_FIELDS);
    }
  };

  document.getElementById('btn-register').onclick = async () => {
    const containerId = 'view-auth';

    try {
      clearFormErrors(containerId);

      const e = document.getElementById('email').value;
      const p = document.getElementById('password').value;

      const email = validateEmail(e);
      const password = validatePassword(p);

      const res = await register(email, password);

      if (res.ok) {
        showFormSuccess(
          containerId,
          'Konto zostało utworzone pomyślnie. Możesz się teraz zalogować.'
        );
      } else {
        showFormError(containerId, res.error, AUTH_FIELDS);
      }
    } catch (error) {
      showFormError(containerId, error, AUTH_FIELDS);
    }
  };

  document.getElementById('btn-logout').onclick = async () => {
  const confirmed = await confirmAction({
    title: 'Wylogowanie',
    message: 'Czy na pewno chcesz się wylogować z aplikacji?',
    confirmText: 'Wyloguj',
    cancelText: 'Anuluj',
    danger: false
  });

  if (confirmed) {
    await logout();
    clearInputs('view-auth');
    showView('view-auth');
  }
};
}