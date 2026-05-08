import { getFuelRecordsByVehicle, addFuelRecord, deleteFuelRecord, updateFuelRecord } from '../services/fuelRecordService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs } from '../uiUtils.js';
import { validateFuelRecordData } from '../validators.js';

import { storage, auth } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Pobieranie i wyświetlanie historii tankowań dla wybranego pojazdu
export async function loadFuelRecords() {
  const list = document.getElementById('records-list');
  if (!list) return;
  clear(list);

  const res = await getFuelRecordsByVehicle(state.currentVehicleId);

  if (res.ok && res.data.length > 0) {
    res.data.forEach(r => {
      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [`Data: ${r.date}`]),
            el('p', {}, [`${r.cost} PLN | ${r.liters} L`]),
            r.consumption ? el('p', { className: 'consumption-text' }, [`Spalanie: ${r.consumption} l/100km`]) : '',
            r.attachmentUrl ? el('a', {
              href: r.attachmentUrl,
              target: '_blank',
              className: 'attachment-link'
            }, ['Zobacz załącznik']) : ''
          ]),
          el('div', { className: 'actions-vertical' }, [
            el('button', {
              className: 'small secondary',
              onclick: (e) => { e.stopPropagation(); startEdit(r); }
            }, ['Edytuj']),
            el('button', {
              className: 'small secondary danger-text',
              onclick: (e) => { e.stopPropagation(); remove(r.id); }
            }, ['Usuń'])
          ])
        ])
      ]);
      list.appendChild(li);
    });
  } else {
    list.appendChild(el('p', { className: 'empty-state' }, ['Brak wpisów o tankowaniu.']));
  }
}

// Wypełnianie formularza edycji danymi z wybranego tankowania
function startEdit(r) {
  state.editFuelId = r.id;
  document.getElementById('edit-fuel-date').value = r.date;
  document.getElementById('edit-fuel-mileage').value = r.mileage;
  document.getElementById('edit-fuel-liters').value = r.liters;
  document.getElementById('edit-fuel-cost').value = r.cost;

  const fileInput = document.getElementById('edit-fuel-file');
  if (fileInput) fileInput.value = '';

  showView('view-edit-fuel');
}

// Usuwanie wpisu o tankowaniu
async function remove(id) {
  if (confirm("Czy na pewno chcesz usunąć ten wpis o tankowaniu?")) {
    const res = await deleteFuelRecord(id);
    if (res.ok) {
      loadFuelRecords();
    } else {
      alert("Błąd podczas usuwania: " + res.error.message);
    }
  }
}

export function initFuelHandlers() {

  // Otwieranie formularza dodawania nowego tankowania
  document.getElementById('btn-show-add-fuel').onclick = () => {
    document.getElementById('fuel-date').value = new Date().toISOString().split('T')[0];
    const fileInput = document.getElementById('fuel-file');
    if (fileInput) fileInput.value = '';
    showView('view-add-fuel');
  };

  // Zapisywanie nowego tankowania
  document.getElementById('btn-save-fuel').onclick = async () => {
    const btn = document.getElementById('btn-save-fuel');
    try {
      const fileInput = document.getElementById('fuel-file');
      const file = fileInput.files[0];
      let attachmentUrl = null;

      if (file) {
        btn.innerText = "Wysyłanie zdjęcia...";
        btn.disabled = true;
        const storageRef = ref(storage, `fuel_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        attachmentUrl = await getDownloadURL(snapshot.ref);
      }

      const rawData = {
        vehicleId: state.currentVehicleId,
        date: document.getElementById('fuel-date').value,
        mileage: document.getElementById('fuel-mileage').value,
        liters: document.getElementById('fuel-liters').value,
        cost: document.getElementById('fuel-cost').value,
        attachmentUrl: attachmentUrl
      };

      const validatedData = validateFuelRecordData(rawData);
      const res = await addFuelRecord(validatedData);

      if (res.ok) {
        clearInputs('view-add-fuel');
        showView('view-vehicle-details');
        loadFuelRecords();
      } else {
        alert("Błąd serwera: " + res.error.message);
      }
    } catch (error) {
      alert(error.message);
    } finally {
      btn.innerText = "Zapisz tankowanie";
      btn.disabled = false;
    }
  };

  // Zapisywanie zmian w edytowanym tankowaniu
  document.getElementById('btn-update-fuel').onclick = async () => {
    const btn = document.getElementById('btn-update-fuel');
    try {
      const fileInput = document.getElementById('edit-fuel-file');
      const file = fileInput.files[0];
      let attachmentUrl = null;

      if (file) {
        btn.innerText = "Wysyłanie zdjęcia...";
        btn.disabled = true;
        const storageRef = ref(storage, `fuel_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        attachmentUrl = await getDownloadURL(snapshot.ref);
      }

      const rawData = {
        date: document.getElementById('edit-fuel-date').value,
        mileage: document.getElementById('edit-fuel-mileage').value,
        liters: document.getElementById('edit-fuel-liters').value,
        cost: document.getElementById('edit-fuel-cost').value,
        attachmentUrl: attachmentUrl || undefined
      };

      const validatedData = validateFuelRecordData({ ...rawData, vehicleId: state.currentVehicleId });
      const res = await updateFuelRecord(state.editFuelId, validatedData);

      if (res.ok) {
        clearInputs('view-edit-fuel');
        showView('view-vehicle-details');
        loadFuelRecords();
      } else {
        alert("Błąd aktualizacji: " + res.error.message);
      }
    } catch (error) {
      alert(error.message);
    } finally {
      btn.innerText = "Zapisz zmiany";
      btn.disabled = false;
    }
  };
}