import { login, register, logout } from '../services/authService.js';
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation
} from '../validators.js';
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
  password: 'password',
  passwordConfirm: 'password-confirm'
};

let isRegisterMode = false;

function setAuthMode(mode) {
  isRegisterMode = mode === 'register';

  const confirmGroup = document.getElementById('password-confirm-group');
  const loginBtn = document.getElementById('btn-login');
  const registerBtn = document.getElementById('btn-register');
  const backLoginBtn = document.getElementById('btn-back-login');

  clearFormErrors('view-auth');

  if (isRegisterMode) {
    confirmGroup.classList.remove('hidden');

    loginBtn.classList.add('hidden');

    registerBtn.classList.remove('text-action');
    registerBtn.classList.add('primary');
    registerBtn.textContent = 'Utwórz konto';

    backLoginBtn.classList.remove('hidden');
  } else {
    confirmGroup.classList.add('hidden');

    loginBtn.classList.remove('hidden');

    registerBtn.classList.remove('primary');
    registerBtn.classList.add('text-action');
    registerBtn.textContent = 'Zarejestruj się';

    backLoginBtn.classList.add('hidden');

    const passwordConfirmInput = document.getElementById('password-confirm');
    if (passwordConfirmInput) {
      passwordConfirmInput.value = '';
    }
  }
}

export function initAuthHandlers() {
  setAuthMode('login');

  document.getElementById('btn-login').onclick = async () => {
    const containerId = 'view-auth';

    try {
      clearFormErrors(containerId);

      const emailValue = document.getElementById('email').value;
      const passwordValue = document.getElementById('password').value;

      const email = validateEmail(emailValue);
      const password = validatePassword(passwordValue);

      const res = await login(email, password);

      if (res.ok) {
        clearInputs(containerId);
        setAuthMode('login');
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

    if (!isRegisterMode) {
      setAuthMode('register');
      return;
    }

    try {
      clearFormErrors(containerId);

      const emailValue = document.getElementById('email').value;
      const passwordValue = document.getElementById('password').value;
      const passwordConfirmValue = document.getElementById('password-confirm').value;

      const email = validateEmail(emailValue);
      const password = validatePassword(passwordValue);

      validatePasswordConfirmation(passwordValue, passwordConfirmValue);

      const res = await register(email, password);

      if (res.ok) {
        showFormSuccess(
          containerId,
          'Konto zostało utworzone pomyślnie. Możesz się teraz zalogować.'
        );

        document.getElementById('password').value = '';
        document.getElementById('password-confirm').value = '';
        setAuthMode('login');
      } else {
        showFormError(containerId, res.error, AUTH_FIELDS);
      }
    } catch (error) {
      showFormError(containerId, error, AUTH_FIELDS);
    }
  };

  document.getElementById('btn-back-login').onclick = () => {
    setAuthMode('login');
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
      setAuthMode('login');
      showView('view-auth');
    }
  };
}