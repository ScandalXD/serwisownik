// Własny typ błędu aplikacji
export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', field = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.field = field;
  }
}

function getErrorMessage(error) {
  if (!error) return 'Wystąpił nieoczekiwany błąd.';

  const code = error.code || '';

  const friendlyMessages = {
    'auth/invalid-credential': 'Nieprawidłowy e-mail lub hasło.',
    'auth/user-not-found': 'Nie znaleziono użytkownika o podanym adresie e-mail.',
    'auth/wrong-password': 'Nieprawidłowe hasło.',
    'auth/email-already-in-use': 'Konto z tym adresem e-mail już istnieje.',
    'auth/weak-password': 'Hasło jest zbyt słabe. Użyj co najmniej 6 znaków.',
    'auth/too-many-requests': 'Zbyt wiele prób logowania. Spróbuj ponownie za chwilę.',
    'permission-denied': 'Brak uprawnień do wykonania tej operacji.',
    'storage/unauthorized': 'Brak uprawnień do przesłania pliku. Sprawdź reguły Firebase Storage.',
    'storage/canceled': 'Wysyłanie pliku zostało anulowane.',
    'storage/unknown': 'Nie udało się wysłać pliku. Spróbuj ponownie.',
    'AUTH_REQUIRED': 'Musisz być zalogowany, aby wykonać tę operację.',
    'VALIDATION_ERROR': error.message || 'Sprawdź poprawność danych w formularzu.',
    'INVALID_YEAR': error.message || 'Podaj poprawny rocznik pojazdu.'
  };

  return friendlyMessages[code] || error.message || 'Wystąpił nieoczekiwany błąd.';
}

function getFormContainer(containerOrId) {
  if (typeof containerOrId === 'string') {
    return document.getElementById(containerOrId);
  }

  return containerOrId || document.querySelector('.view.active .container');
}

function ensureMessageBox(container, type = 'error') {
  let messageBox = container.querySelector(':scope > .form-message');

  if (!messageBox) {
    messageBox = document.createElement('div');
    messageBox.className = 'form-message';

    const primaryButton = container.querySelector('button.primary');
    if (primaryButton) {
      primaryButton.insertAdjacentElement('beforebegin', messageBox);
    } else {
      container.prepend(messageBox);
    }
  }

  messageBox.className = `form-message ${type}`;
  return messageBox;
}

export function clearFormErrors(containerOrId = null) {
  const container = getFormContainer(containerOrId);
  if (!container) return;

  container.querySelectorAll('.form-message').forEach((element) => element.remove());
  container.querySelectorAll('.field-error').forEach((element) => element.remove());
  container.querySelectorAll('.input-error').forEach((element) => {
    element.classList.remove('input-error');
    element.removeAttribute('aria-invalid');
  });
}

export function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return false;

  input.classList.add('input-error');
  input.setAttribute('aria-invalid', 'true');

  const oldError = input.parentElement?.querySelector(`.field-error[data-for="${inputId}"]`);
  if (oldError) oldError.remove();

  const errorElement = document.createElement('div');
  errorElement.className = 'field-error';
  errorElement.dataset.for = inputId;
  errorElement.textContent = message;

  input.insertAdjacentElement('afterend', errorElement);
  input.focus();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return true;
}

export function showFormError(containerOrId, error, fieldMap = {}) {
  const container = getFormContainer(containerOrId);
  if (!container) return;

  clearFormErrors(container);

  const message = getErrorMessage(error);
  const field = error?.field;
  const inputId = field ? fieldMap[field] : null;

  if (inputId && showFieldError(inputId, message)) {
    return;
  }

  const messageBox = ensureMessageBox(container, 'error');
  messageBox.textContent = message;
  messageBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function showFormSuccess(containerOrId, message) {
  const container = getFormContainer(containerOrId);
  if (!container) return;

  clearFormErrors(container);

  const messageBox = ensureMessageBox(container, 'success');
  messageBox.textContent = message;
}

export function handleError(error, containerOrId = null, fieldMap = {}) {
  console.error(`[${error?.code || 'ERROR'}]: ${error?.message || error}`);
  showFormError(containerOrId, error, fieldMap);
}