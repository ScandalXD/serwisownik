import { clearFormErrors } from './errors.js';

// Przełączanie ekranów
export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);

  if (target) {
    clearFormErrors(target);
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// Czyszczenie formularzy
export function clearInputs(viewId) {
  const container = document.getElementById(viewId);
  if (!container) return;

  clearFormErrors(container);

  const fields = container.querySelectorAll('input, textarea, select');

  fields.forEach(field => {
    if (field.type === 'checkbox' || field.type === 'radio') {
      field.checked = false;
    } else {
      field.value = '';
    }
  });
}

// Resetowanie zakładek w szczegółach auta
export function resetTabs() {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('btn-show-add-fuel').style.display = 'none';
  document.getElementById('btn-show-add-service').style.display = 'none';
  document.getElementById('btn-show-add-reminder').style.display = 'none';
}

// Okno potwierdzenia
export function confirmAction({
  title = 'Potwierdzenie',
  message = 'Czy na pewno chcesz wykonać tę operację?',
  confirmText = 'Potwierdź',
  cancelText = 'Anuluj',
  danger = false
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';

    const titleEl = document.createElement('h3');
    titleEl.textContent = title;

    const messageEl = document.createElement('p');
    messageEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'secondary';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = danger ? 'modal-confirm-btn danger' : 'modal-confirm-btn';
    confirmBtn.textContent = confirmText;

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    modal.appendChild(titleEl);
    modal.appendChild(messageEl);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close(result) {
      overlay.classList.add('modal-overlay-hide');

      setTimeout(() => {
        overlay.remove();
        document.removeEventListener('keydown', handleKeyDown);
        resolve(result);
      }, 150);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        close(false);
      }
    }

    cancelBtn.onclick = () => close(false);
    confirmBtn.onclick = () => close(true);

    overlay.onclick = (event) => {
      if (event.target === overlay) {
        close(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    setTimeout(() => {
      confirmBtn.focus();
    }, 50);
  });
}