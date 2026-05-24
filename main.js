import { auth } from './src/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { showView, resetTabs } from './src/uiUtils.js';
import { initAuthHandlers } from './src/handlers/authHandlers.js';
import { initVehicleHandlers, loadVehicles } from './src/handlers/vehicleHandlers.js';
import { initFuelHandlers, loadFuelRecords } from './src/handlers/fuelHandlers.js';
import { initServiceHandlers, loadServiceRecords } from './src/handlers/serviceHandlers.js';
import { initReminderHandlers, loadReminders } from './src/handlers/reminderHandlers.js';
import { initNotificationHandlers, checkNotifications } from './src/handlers/notificationHandlers.js';

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('Sesja aktywna dla:', user.email);
    showView('view-dashboard');
    loadVehicles();
    checkNotifications();
  } else {
    showView('view-auth');
  }
});

document.getElementById('tab-fuel').onclick = (e) => {
  resetTabs();
  e.target.classList.add('active');
  document.getElementById('btn-show-add-fuel').style.display = 'block';
  loadFuelRecords();
};

document.getElementById('tab-service').onclick = (e) => {
  resetTabs();
  e.target.classList.add('active');
  document.getElementById('btn-show-add-service').style.display = 'block';
  loadServiceRecords();
};

document.getElementById('tab-reminder').onclick = (e) => {
  resetTabs();
  e.target.classList.add('active');
  document.getElementById('btn-show-add-reminder').style.display = 'block';
  loadReminders();
};

document.querySelectorAll('.btn-back').forEach(btn => {
  btn.onclick = () => {
    const target = btn.getAttribute('data-target');
    showView(target || 'view-dashboard');

    if (target === 'view-dashboard') {
      loadVehicles();
      checkNotifications();
}
  };
});

initAuthHandlers();
initVehicleHandlers();
initFuelHandlers();
initServiceHandlers();
initReminderHandlers();
initNotificationHandlers();

const integerOnlyInputs = [
  'veh-year',
  'veh-mileage',
  'edit-veh-year',
  'fuel-mileage',
  'edit-fuel-mileage',
  'srv-mileage',
  'edit-srv-mileage',
  'rem-mileage',
  'edit-rem-mileage'
];

integerOnlyInputs.forEach((inputId) => {
  const input = document.getElementById(inputId);

  if (input) {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
    });

    input.addEventListener('paste', () => {
      setTimeout(() => {
        input.value = input.value.replace(/\D/g, '');
      }, 0);
    });
  }
});

const decimalInputs = [
  'fuel-liters',
  'fuel-cost',
  'edit-fuel-liters',
  'edit-fuel-cost',
  'srv-cost',
  'edit-srv-cost'
];

decimalInputs.forEach((inputId) => {
  const input = document.getElementById(inputId);

  if (input) {
    input.addEventListener('input', () => {
      let value = input.value.replace(',', '.');
      value = value.replace(/[^0-9.]/g, '');

      const parts = value.split('.');
      if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
      }

      input.value = value;
    });

    input.addEventListener('paste', () => {
      setTimeout(() => {
        let value = input.value.replace(',', '.');
        value = value.replace(/[^0-9.]/g, '');

        const parts = value.split('.');
        if (parts.length > 2) {
          value = parts[0] + '.' + parts.slice(1).join('');
        }

        input.value = value;
      }, 0);
    });
  }
});