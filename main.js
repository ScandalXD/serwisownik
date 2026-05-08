import { auth } from './src/firebase.js';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { showView, resetTabs } from './src/uiUtils.js';
import { initAuthHandlers } from './src/handlers/authHandlers.js';
import { initVehicleHandlers, loadVehicles } from './src/handlers/vehicleHandlers.js'; 
import { initFuelHandlers, loadFuelRecords } from './src/handlers/fuelHandlers.js';
import { initServiceHandlers, loadServiceRecords } from './src/handlers/serviceHandlers.js';
import { initReminderHandlers, loadReminders } from './src/handlers/reminderHandlers.js';
import { initNotificationHandlers, checkNotifications } from './src/handlers/notificationHandlers.js';

// Monitorowanie stanu zalogowania
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Sesja aktywna dla:", user.email);
    showView('view-dashboard');
    loadVehicles(); 
    checkNotifications();
  } else {
    showView('view-auth');
  }
});

// Obsługa wylogowania
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    if (confirm("Czy na pewno chcesz się wylogować?")) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Błąd wylogowania:", error.message);
      }
    }
  };
}

// Obsługa zakładek w szczegółach pojazdu
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

// Obsługa przycisków "Wstecz"
document.querySelectorAll('.btn-back').forEach(btn => {
  btn.onclick = () => {    
    const target = btn.getAttribute('data-target');    
    showView(target || 'view-dashboard');
    
    if (target === 'view-dashboard') {
      checkNotifications();
    }
  };
});

// Inicjalizacja wszystkich handlerów

initAuthHandlers();
initVehicleHandlers();
initFuelHandlers();
initServiceHandlers();
initReminderHandlers();
initNotificationHandlers();
