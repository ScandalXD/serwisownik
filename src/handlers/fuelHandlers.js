import { getFuelRecordsByVehicle, addFuelRecord, deleteFuelRecord, updateFuelRecord } from '../services/fuelRecordService.js';
import { syncVehicleMileage } from '../services/vehicleService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs, showNotification, showConfirm, showFieldError, clearFieldErrors } from '../uiUtils.js';
import { validateFuelRecordData } from '../validators.js';
import { storage, auth } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { loadVehicles } from './vehicleHandlers.js';

// Wizualna walidacja formularza
function validateForm(dateEl, mileageEl, litersEl, costEl, currentMileage, isEdit = false) {
  clearFieldErrors(); 
  let isValid = true;

  if (!dateEl.value) { 
      showFieldError(dateEl, "Data jest wymagana."); 
      isValid = false; 
  }
  
  const mileage = Number(mileageEl.value);
  if (mileage <= 0) { 
      showFieldError(mileageEl, "Przebieg musi być większy od 0."); 
      isValid = false; 
  } else if (!isEdit && currentMileage > 0 && mileage <= currentMileage) {
      showFieldError(mileageEl, `Przebieg musi być większy niż aktualny (${currentMileage} km).`);
      isValid = false;
  }
  
  if (Number(litersEl.value) <= 0) { 
      showFieldError(litersEl, "Wpisz poprawną ilość litrów."); 
      isValid = false; 
  }
  
  if (costEl.value === "" || Number(costEl.value) < 0) { 
      showFieldError(costEl, "Podaj poprawny koszt całkowity."); 
      isValid = false; 
  }
  
  return isValid;
}

// Pobieranie i wyświetlanie historii tankowań
export async function loadFuelRecords() {
  const list = document.getElementById('records-list');
  if (!list) return;
  clear(list);

  const res = await getFuelRecordsByVehicle(state.currentVehicleId);

  if (res.ok && res.data.length > 0) {
    const sortedData = res.data.sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      
      if (dateDiff !== 0) {
        return dateDiff; 
      }
      
      const timeB = b.createdAt?.seconds || 0;
      const timeA = a.createdAt?.seconds || 0;
      return timeB - timeA; 
    });

    sortedData.forEach(r => {
      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [`Data: ${r.date}`]),
            el('p', {}, [`${r.cost} PLN | ${r.liters} L`]),
            r.consumption ? el('p', { className: 'consumption-text' }, [`Spalanie: ${r.consumption} l/100km`]) : '',
            r.attachmentUrl ? el('a', { href: r.attachmentUrl, target: '_blank', className: 'attachment-link' }, ['Zobacz załącznik']) : ''
          ]),
          el('div', { className: 'actions-vertical' }, [
            el('button', { className: 'small secondary', onclick: (e) => { e.stopPropagation(); startEdit(r); } }, ['Edytuj']),
            el('button', { className: 'small secondary danger-text', onclick: (e) => { e.stopPropagation(); remove(r.id); } }, ['Usuń'])
          ])
        ])
      ]);
      list.appendChild(li);
    });
  } else {
    list.appendChild(el('p', { className: 'empty-state' }, ['Brak wpisów o tankowaniu.']));
  }
}

// Przygotowanie formularza edycji tankowania
function startEdit(r) {
  clearFieldErrors();

  state.editFuelId = r.id;
  state.editFuelAttachmentUrl = r.attachmentUrl;

  document.getElementById('edit-fuel-date').value = r.date;
  document.getElementById('edit-fuel-mileage').value = r.mileage;
  document.getElementById('edit-fuel-liters').value = r.liters;
  document.getElementById('edit-fuel-cost').value = r.cost;

  const fileInput = document.getElementById('edit-fuel-file');
  if (fileInput) fileInput.value = '';

  const removeContainer = document.getElementById('edit-fuel-remove-file-container');
  const removeCheckbox = document.getElementById('edit-fuel-remove-file');
  
  if (removeCheckbox) removeCheckbox.checked = false;

  if (removeContainer) {
      removeContainer.style.display = r.attachmentUrl ? 'flex' : 'none';
  }

  showView('view-edit-fuel');
}

async function remove(id) {
  showConfirm("Czy na pewno chcesz usunąć ten wpis o tankowaniu?", async () => {
    const res = await deleteFuelRecord(id);
    if (res.ok) {
      showNotification("Wpis został usunięty", "info");
      loadFuelRecords();
    } else {
      showNotification("Błąd: " + res.error.message, "error");
    }
  });
}

export function initFuelHandlers() {
  document.getElementById('btn-show-add-fuel').onclick = () => {
    clearFieldErrors();
    document.getElementById('fuel-date').value = new Date().toISOString().split('T')[0];
    const fileInput = document.getElementById('fuel-file');
    if (fileInput) fileInput.value = '';
    showView('view-add-fuel');
  };

  // Zapisywanie nowego tankowania
  document.getElementById('btn-save-fuel').onclick = async () => {
    const btn = document.getElementById('btn-save-fuel');
    const dateInput = document.getElementById('fuel-date');
    const mileageInput = document.getElementById('fuel-mileage');
    const litersInput = document.getElementById('fuel-liters');
    const costInput = document.getElementById('fuel-cost');
    const currentMileage = Number(state.currentVehicleMileage || 0);

    if (!validateForm(dateInput, mileageInput, litersInput, costInput, currentMileage, false)) return;

    try {
      btn.innerText = "Zapisywanie...";
      btn.disabled = true;

      const fileInput = document.getElementById('fuel-file');
      const file = fileInput.files[0];
      let attachmentUrl = null;

      if (file) {
        btn.innerText = "Wysyłanie zdjęcia...";
        const storageRef = ref(storage, `fuel_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        attachmentUrl = await getDownloadURL(snapshot.ref);
      }

      const rawData = {
        vehicleId: state.currentVehicleId,
        date: dateInput.value,
        mileage: Number(mileageInput.value),
        liters: litersInput.value,
        cost: costInput.value,
        attachmentUrl: attachmentUrl
      };

      const res = await addFuelRecord(validateFuelRecordData(rawData));
      if (res.ok) {
        if (rawData.mileage > currentMileage) {
             await syncVehicleMileage(state.currentVehicleId, rawData.mileage);
             state.currentVehicleMileage = rawData.mileage;
             loadVehicles(); 
        }

        showNotification("Zapisano tankowanie", "success");
        clearInputs('view-add-fuel');
        showView('view-vehicle-details');
        loadFuelRecords();
      } else {
        showNotification("Błąd: " + res.error.message, "error");
      }
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      btn.innerText = "Zapisz tankowanie";
      btn.disabled = false;
    }
  };

  // Zapisywanie edycji tankowania
  document.getElementById('btn-update-fuel').onclick = async () => {
    const btn = document.getElementById('btn-update-fuel');
    const dateInput = document.getElementById('edit-fuel-date');
    const mileageInput = document.getElementById('edit-fuel-mileage');
    const litersInput = document.getElementById('edit-fuel-liters');
    const costInput = document.getElementById('edit-fuel-cost');
    const currentMileage = Number(state.currentVehicleMileage || 0);

    if (!validateForm(dateInput, mileageInput, litersInput, costInput, currentMileage, true)) return;

    try {
      btn.innerText = "Zapisywanie...";
      btn.disabled = true;

      const fileInput = document.getElementById('edit-fuel-file');
      const file = fileInput.files[0];
      const removeCheckbox = document.getElementById('edit-fuel-remove-file'); 
      
      let attachmentUrl = state.editFuelAttachmentUrl || null;

      if (file) {
        btn.innerText = "Wysyłanie zdjęcia...";
        const storageRef = ref(storage, `fuel_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        attachmentUrl = await getDownloadURL(snapshot.ref);
      } else if (removeCheckbox && removeCheckbox.checked) {
        attachmentUrl = null;
      }

      const rawData = {
        date: dateInput.value,
        mileage: Number(mileageInput.value),
        liters: litersInput.value,
        cost: costInput.value,
        attachmentUrl: attachmentUrl 
      };

      const res = await updateFuelRecord(state.editFuelId, validateFuelRecordData({ ...rawData, vehicleId: state.currentVehicleId }));
      
      if (res.ok) {
        if (rawData.mileage > currentMileage) {
             await syncVehicleMileage(state.currentVehicleId, rawData.mileage);
             state.currentVehicleMileage = rawData.mileage;
             loadVehicles(); 
        }

        showNotification("Zaktualizowano tankowanie", "success");
        clearInputs('view-edit-fuel');
        showView('view-vehicle-details');
        loadFuelRecords();
      } else {
        showNotification("Błąd: " + res.error.message, "error");
      }
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      btn.innerText = "Zapisz zmiany";
      btn.disabled = false;
    }
  };
}
