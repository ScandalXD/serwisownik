import { getServiceRecordsByVehicle, addServiceRecord, deleteServiceRecord, updateServiceRecord } from '../services/serviceRecordService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs } from '../uiUtils.js';
import { validateServiceRecordData } from '../validators.js';

import { storage, auth } from '../firebase.js'; 
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Pobieranie i wyświetlanie historii napraw/serwisów dla wybranego pojazdu
export async function loadServiceRecords() {
  const list = document.getElementById('records-list');
  if (!list) return;
  clear(list);

  const res = await getServiceRecordsByVehicle(state.currentVehicleId);
  
  if (res.ok && res.data.length > 0) {
    res.data.forEach(r => {
      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [r.description]),
            el('p', {}, [`${r.cost} PLN | Data: ${r.date}`]),
            el('p', { className: 'record-meta' }, [`Przebieg: ${r.mileage} km`]),
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
    list.appendChild(el('p', { className: 'empty-state' }, ['Brak wpisów serwisowych.'])); 
  }
}

// Wypełnianie formularza edycji danymi z wybranego wpisu serwisowego
function startEdit(r) {
  state.editServiceId = r.id;
  document.getElementById('edit-srv-date').value = r.date;
  document.getElementById('edit-srv-desc').value = r.description;
  document.getElementById('edit-srv-mileage').value = r.mileage;
  document.getElementById('edit-srv-cost').value = r.cost;
  
  const fileInput = document.getElementById('edit-srv-file');
  if(fileInput) fileInput.value = '';
  
  showView('view-edit-service');
}

// Usuwanie wpisu z historii serwisowej
async function remove(id) {
  if (confirm("Czy na pewno chcesz usunąć ten wpis serwisowy?")) {
    const res = await deleteServiceRecord(id);
    if (res.ok) {
      loadServiceRecords();
    } else {
      alert("Błąd podczas usuwania: " + res.error.message);
    }
  }
}

export function initServiceHandlers() {
  
  // Otwieranie formularza dodawania nowej naprawy
  const addBtn = document.getElementById('btn-show-add-service');
  if(addBtn) {
    addBtn.onclick = () => {
      document.getElementById('srv-date').value = new Date().toISOString().split('T')[0];
      const fileInput = document.getElementById('srv-file');
      if(fileInput) fileInput.value = '';
      showView('view-add-service');
    };
  }

  // Zapisywanie nowego wpisu
  const saveBtn = document.getElementById('btn-save-service');
  if(saveBtn) {
    saveBtn.onclick = async () => {
      try {
        const fileInput = document.getElementById('srv-file');
        const file = fileInput.files[0];
        let attachmentUrl = null;

        if (file) {
          saveBtn.innerText = "Wysyłanie pliku...";
          saveBtn.disabled = true;
          const storageRef = ref(storage, `service_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          attachmentUrl = await getDownloadURL(snapshot.ref);
        }

        const rawData = {
          vehicleId: state.currentVehicleId,
          date: document.getElementById('srv-date').value,
          description: document.getElementById('srv-desc').value,
          mileage: document.getElementById('srv-mileage').value,
          cost: document.getElementById('srv-cost').value,
          attachmentUrl: attachmentUrl
        };

        const validatedData = validateServiceRecordData(rawData);
        const res = await addServiceRecord(validatedData);
        
        if (res.ok) {
          clearInputs('view-add-service'); 
          showView('view-vehicle-details');
          loadServiceRecords();
        } else {
          alert("Błąd serwera: " + res.error.message);
        }
      } catch (error) {
        alert(error.message); 
      } finally {
        saveBtn.innerText = "Zapisz wpis";
        saveBtn.disabled = false;
      }
    };
  }

  // Zapisywanie zmian w edytowanym wpisie
  const updateBtn = document.getElementById('btn-update-service');
  if(updateBtn) {
    updateBtn.onclick = async () => {
      try {
        const fileInput = document.getElementById('edit-srv-file');
        const file = fileInput.files[0];
        let attachmentUrl = null;

        if (file) {
          updateBtn.innerText = "Wysyłanie zdjęcia...";
          updateBtn.disabled = true;
          const storageRef = ref(storage, `service_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          attachmentUrl = await getDownloadURL(snapshot.ref);
        }

        const rawData = {
          date: document.getElementById('edit-srv-date').value,
          description: document.getElementById('edit-srv-desc').value,
          mileage: document.getElementById('edit-srv-mileage').value,
          cost: document.getElementById('edit-srv-cost').value,
          attachmentUrl: attachmentUrl || undefined
        };

        const validatedData = validateServiceRecordData({ ...rawData, vehicleId: state.currentVehicleId });
        const res = await updateServiceRecord(state.editServiceId, validatedData);
        
        if (res.ok) {
          clearInputs('view-edit-service'); 
          showView('view-vehicle-details');
          loadServiceRecords();
        } else {
          alert("Błąd aktualizacji: " + res.error.message);
        }
      } catch (error) {
        alert(error.message);
      } finally {
        updateBtn.innerText = "Zapisz zmiany";
        updateBtn.disabled = false;
      }
    };
  }
}