import { auth } from './src/firebase.js';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { showView, resetTabs, showConfirm } from './src/uiUtils.js'; 
import { initAuthHandlers } from './src/handlers/authHandlers.js';
import { initVehicleHandlers, loadVehicles } from './src/handlers/vehicleHandlers.js'; 
import { initFuelHandlers, loadFuelRecords } from './src/handlers/fuelHandlers.js';
import { initServiceHandlers, loadServiceRecords } from './src/handlers/serviceHandlers.js';
import { initReminderHandlers, loadReminders } from './src/handlers/reminderHandlers.js';
import { initNotificationHandlers, checkNotifications } from './src/handlers/notificationHandlers.js';
import { initSettingsHandlers } from './src/handlers/settingsHandlers.js';
import { el, clear } from './src/domHelpers.js';
import { registerSW } from 'virtual:pwa-register';

// Czyszczenie komunikatów walidacji
document.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT') {
        e.target.setCustomValidity('');
    }
});

// Monitorowanie stanu zalogowania
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Sesja aktywna dla:", user.email);
        
        const titleEl = document.getElementById('dashboard-title');
        if (titleEl) {
            titleEl.textContent = user.displayName ? `Garaż: ${user.displayName}` : 'Garaż';
        }

        const savedView = localStorage.getItem('last_active_view');
        showView(savedView || 'view-dashboard');

        loadVehicles(); 
        checkNotifications();
    } else {
        showView('view-login');
    }
});

// Obsługa wylogowania
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.onclick = () => {
        showConfirm("Czy na pewno chcesz się wylogować z aplikacji?", async () => {
            try {
                localStorage.removeItem('last_active_view');
                await signOut(auth);
            } catch (error) {
                console.error("Błąd wylogowania:", error.message);
            }
        });
    };
}

// Ustawienia
const btnSettings = document.getElementById('btn-go-settings');
if (btnSettings) {
    btnSettings.onclick = () => { showView('view-settings'); };
}

// Obsługa zakładek w szczegółach pojazdu
const recordsList = document.getElementById('records-list');
const btnAddFuel = document.getElementById('btn-show-add-fuel');
const btnAddService = document.getElementById('btn-show-add-service');
const btnAddReminder = document.getElementById('btn-show-add-reminder');

document.getElementById('tab-fuel').onclick = (e) => {
    if (e.target.classList.contains('active')) return;
    resetTabs(); 
    e.target.classList.add('active');
    
    clear(recordsList);
    
    btnAddFuel.style.display = 'block';
    btnAddService.style.display = 'none';
    btnAddReminder.style.display = 'none';
    loadFuelRecords();
};

document.getElementById('tab-service').onclick = (e) => {
    if (e.target.classList.contains('active')) return;
    resetTabs(); 
    e.target.classList.add('active');
    
    clear(recordsList);
    
    btnAddFuel.style.display = 'none';
    btnAddService.style.display = 'block';
    btnAddReminder.style.display = 'none';
    loadServiceRecords();
};

document.getElementById('tab-reminder').onclick = (e) => {
    if (e.target.classList.contains('active')) return;
    resetTabs(); 
    e.target.classList.add('active');
    
    clear(recordsList);
    
    btnAddFuel.style.display = 'none';
    btnAddService.style.display = 'none';
    btnAddReminder.style.display = 'block';
    loadReminders();
};

// Obsługa przycisków "Wstecz"
document.querySelectorAll('.btn-back').forEach(btn => {
    btn.onclick = () => {     
        const target = btn.getAttribute('data-target');     
        showView(target || 'view-dashboard');
        
        if (target === 'view-dashboard') {
            checkNotifications();
            loadVehicles();
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
initSettingsHandlers();

// Anulowanie załączników
const fileInputsConfig = [
    { inputId: 'veh-photo', btnId: 'btn-cancel-veh' },
    { inputId: 'edit-veh-photo', btnId: 'btn-cancel-edit-veh' },
    { inputId: 'fuel-file', btnId: 'btn-cancel-fuel' },
    { inputId: 'edit-fuel-file', btnId: 'btn-cancel-edit-fuel' },
    { inputId: 'srv-file', btnId: 'btn-cancel-srv' },
    { inputId: 'edit-srv-file', btnId: 'btn-cancel-edit-srv' }
];

function syncFileCancelButtons() {
    fileInputsConfig.forEach(({ inputId, btnId }) => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (input && btn) {
            btn.style.display = input.files && input.files.length > 0 ? 'flex' : 'none';
        }
    });
}

fileInputsConfig.forEach(({ inputId, btnId }) => {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (input && btn) {
        input.addEventListener('change', syncFileCancelButtons);
        btn.addEventListener('click', () => {
            input.value = ''; 
            syncFileCancelButtons();
        });
    }
});

setInterval(syncFileCancelButtons, 250);

// Rejestracja PWA
const updateSW = registerSW({
    onNeedRefresh() { console.log('Dostępna nowa wersja aplikacji!'); },
    onOfflineReady() { console.log('Aplikacja PWA jest gotowa do działania offline!'); },
});

// Informacja o połączeniu sieciowym
const offlineBanner = document.getElementById('offline-banner');

function updateNetworkStatus() {
    if (offlineBanner) {
        offlineBanner.style.display = navigator.onLine ? 'none' : 'block';
    }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();
