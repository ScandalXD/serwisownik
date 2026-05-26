import { checkNotifications } from './handlers/notificationHandlers.js';

// Obsługa błędów
export function showFieldError(inputEl, message) {
  if (!inputEl) return;
  
  inputEl.classList.add('input-error');

  if (inputEl.nextSibling && inputEl.nextSibling.className === 'custom-field-error') {
     inputEl.nextSibling.innerText = message;
     return;
  }
  const errorDiv = document.createElement('div');
  errorDiv.className = 'custom-field-error';
  errorDiv.innerText = message;
  
  inputEl.parentNode.insertBefore(errorDiv, inputEl.nextSibling);
}
// Czyszczenie komunikatów błędów
export function clearFieldErrors(containerId = null) {
  const container = containerId ? document.getElementById(containerId) : document;
  if (!container) return;
  
  container.querySelectorAll('.custom-field-error').forEach(e => e.remove());
  
  container.querySelectorAll('.input-error').forEach(i => i.classList.remove('input-error'));
}

 // Przełączanie widoków aplikacji
export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// Czyszczenie pola wejściowego
export function clearInputs(viewId) {
  const container = document.getElementById(viewId);
  if (!container) return;
  
  const inputs = container.querySelectorAll('input');
  inputs.forEach(input => {
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.checked = false;
    } else {
      input.value = '';
    }
  });

  clearFieldErrors(viewId);
}

export function resetTabs() {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('btn-show-add-fuel').style.display = 'none';
  document.getElementById('btn-show-add-service').style.display = 'none';
  document.getElementById('btn-show-add-reminder').style.display = 'none';
}

// Funkcja do wyświetlania powiadomień
export function showNotification(message, type = 'success') {
  const container = document.getElementById('ui-notification-container');
  if (!container) return;

  const existingNotification = container.querySelector('.ui-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.className = `ui-notification ${type}`;
  notification.textContent = message;
  
  container.appendChild(notification);
  
  setTimeout(() => {
    if (container.contains(notification)) {
      notification.remove();
    }
  }, 3000);
}

export function showConfirm(message, onConfirm) {
  const modal = document.getElementById('ui-confirm-modal');
  const messageEl = document.getElementById('confirm-message');
  const yesBtn = document.getElementById('btn-confirm-yes');
  const noBtn = document.getElementById('btn-confirm-no');

  messageEl.innerText = message;
  modal.style.display = 'flex';

  // Obsługa przycisków
  yesBtn.onclick = () => {
    modal.style.display = 'none';
    onConfirm();
  };

  noBtn.onclick = () => {
    modal.style.display = 'none';
  };
}
