import { checkNotifications } from './handlers/notificationHandlers.js';

// Przełączanie ekranów
export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// Czyszczenie formularzy
export function clearInputs(viewId) {
  const container = document.getElementById(viewId);
  if (!container) return;
  const inputs = container.querySelectorAll('input');
  inputs.forEach(input => {
    input.value = '';
  });
}

// Resetowanie zakładek w szczegółach auta
export function resetTabs() {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('btn-show-add-fuel').style.display = 'none';
  document.getElementById('btn-show-add-service').style.display = 'none';
  document.getElementById('btn-show-add-reminder').style.display = 'none';
}