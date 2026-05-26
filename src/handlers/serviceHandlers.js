import { getServiceRecordsByVehicle, addServiceRecord, deleteServiceRecord, updateServiceRecord } from '../services/serviceRecordService.js';
import { syncVehicleMileage } from '../services/vehicleService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs, showNotification, showConfirm, showFieldError, clearFieldErrors } from '../uiUtils.js';
import { validateServiceRecordData } from '../validators.js';
import { storage, auth } from '../firebase.js'; 
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { loadVehicles } from './vehicleHandlers.js'; 

// Funkcja pomocnicza obiektów Firebase
function cleanData(obj) {
    const clean = {};
    for (const key in obj) {
        if (obj[key] !== undefined) {
            clean[key] = obj[key];
        }
    }
    return clean;
}

function validateForm(descEl, mileageEl, costEl, currentMileage, isEdit = false) {
  clearFieldErrors(); 
  let isValid = true;
  if (!descEl.value.trim()) {
      showFieldError(descEl, "Opis serwisu jest wymagany.");
      isValid = false;
  }
  const mileage = Number(mileageEl.value);
  if (mileage <= 0) {
      showFieldError(mileageEl, "Przebieg musi być większy od 0.");
      isValid = false;
  } else if (!isEdit && currentMileage > 0 && mileage < currentMileage) {
      showFieldError(mileageEl, `Przebieg nie może być mniejszy niż aktualny (${currentMileage} km).`);
      isValid = false;
  }
  if (costEl.value === "" || Number(costEl.value) < 0) {
      showFieldError(costEl, "Podaj poprawny koszt (min. 0).");
      isValid = false;
  }
  return isValid;
}

// Ładowanie listy wpisów serwisowych
export async function loadServiceRecords() {
  const list = document.getElementById('records-list');
  if (!list) return;
  clear(list);
  
  if (!state.currentVehicleId) return;

  const res = await getServiceRecordsByVehicle(state.currentVehicleId);
  
  if (res.ok && res.data.length > 0) {
    const sortedData = res.data.sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff; 
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0); 
    });

    sortedData.forEach(r => {
      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [r.description]),            
            el('p', {}, [`Koszt: ${r.cost} PLN`]),
            el('p', { className: 'record-meta' }, [`Data: ${r.date}`]),
            el('p', { className: 'record-meta' }, [`Przebieg: ${r.mileage} km`]),           
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
    list.appendChild(el('p', { className: 'empty-state' }, ['Brak wpisów serwisowych.'])); 
  }
}

// Edycja wpisu serwisowego
function startEdit(r) {
  clearFieldErrors();
  state.editServiceId = r.id;
  state.editServiceAttachmentUrl = r.attachmentUrl || null; 

  document.getElementById('edit-srv-date').value = r.date;
  document.getElementById('edit-srv-desc').value = r.description;
  document.getElementById('edit-srv-mileage').value = r.mileage;
  document.getElementById('edit-srv-cost').value = r.cost;
  
  const fileInput = document.getElementById('edit-srv-file');
  if(fileInput) fileInput.value = '';

  const removeContainer = document.getElementById('edit-srv-remove-file-container');
  const removeCheckbox = document.getElementById('edit-srv-remove-file');
  
  if (removeCheckbox) removeCheckbox.checked = false;
  if (removeContainer) {
      removeContainer.style.display = r.attachmentUrl ? 'flex' : 'none';
  }
  showView('view-edit-service');
}

// Usuwanie wpisu serwisowego
async function remove(id) {
  showConfirm("Czy na pewno chcesz usunąć ten wpis serwisowy?", async () => {
    const res = await deleteServiceRecord(id);
    if (res.ok) {
      showNotification("Wpis został usunięty", "info");
      loadServiceRecords();
    } else {
      showNotification("Błąd: " + res.error.message, "error");
    }
  });
}

// Inicjalizacja przycisków interfejsu
export function initServiceHandlers() {
  const addBtn = document.getElementById('btn-show-add-service');
  if(addBtn) {
    addBtn.onclick = () => {
      clearFieldErrors(); 
      document.getElementById('srv-date').value = new Date().toISOString().split('T')[0];
      const fileInput = document.getElementById('srv-file');
      if(fileInput) fileInput.value = '';
      showView('view-add-service');
    };
  }

  const saveBtn = document.getElementById('btn-save-service');
  if(saveBtn) {
    saveBtn.onclick = async () => {
      const srvDesc = document.getElementById('srv-desc');
      const srvMileageInput = document.getElementById('srv-mileage');
      const srvCostInput = document.getElementById('srv-cost');
      const currentMileage = Number(state.currentVehicleMileage || 0);

      if (!validateForm(srvDesc, srvMileageInput, srvCostInput, currentMileage, false)) return;

      try {
        saveBtn.disabled = true;
        saveBtn.innerText = "Zapisywanie...";
        
        const fileInput = document.getElementById('srv-file');
        const file = fileInput.files[0];
        let attachmentUrl = null;

        if (file) {
          const storageRef = ref(storage, `service_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          attachmentUrl = await getDownloadURL(snapshot.ref);
        }

        const rawData = {
          vehicleId: state.currentVehicleId,
          date: document.getElementById('srv-date').value,
          description: srvDesc.value,
          mileage: Number(srvMileageInput.value),
          cost: Number(srvCostInput.value),
          attachmentUrl: attachmentUrl
        };

        const validatedData = validateServiceRecordData(rawData);
        const finalData = cleanData(validatedData);

        const res = await addServiceRecord(finalData);
        if (res.ok) {
          if (rawData.mileage > currentMileage) {
               await syncVehicleMileage(state.currentVehicleId, rawData.mileage);
               state.currentVehicleMileage = rawData.mileage;
               loadVehicles();
          }
          showNotification("Zapisano wpis serwisowy", "success");
          clearInputs('view-add-service'); 
          showView('view-vehicle-details');
          loadServiceRecords();
        } else {
          showNotification("Błąd: " + res.error.message, "error");
        }
      } catch (error) {
        showNotification(error.message, "error");
      } finally {
        saveBtn.innerText = "Zapisz wpis";
        saveBtn.disabled = false;
      }
    };
  }

  const updateBtn = document.getElementById('btn-update-service');
  if(updateBtn) {
    updateBtn.onclick = async () => {
      const srvDesc = document.getElementById('edit-srv-desc');
      const srvMileageInput = document.getElementById('edit-srv-mileage');
      const srvCostInput = document.getElementById('edit-srv-cost');
      const currentMileage = Number(state.currentVehicleMileage || 0);

      if (!validateForm(srvDesc, srvMileageInput, srvCostInput, currentMileage, true)) return;

      try {
        updateBtn.disabled = true;
        updateBtn.innerText = "Zapisywanie...";
        
        const fileInput = document.getElementById('edit-srv-file');
        const removeCheckbox = document.getElementById('edit-srv-remove-file');
        const file = fileInput.files[0];
        
        let attachmentUrl = state.editServiceAttachmentUrl;

        if (removeCheckbox && removeCheckbox.checked) {
            attachmentUrl = null; 
        } else if (file) {
            const storageRef = ref(storage, `service_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            attachmentUrl = await getDownloadURL(snapshot.ref);
        }

        const rawData = {
          vehicleId: state.currentVehicleId,
          date: document.getElementById('edit-srv-date').value,
          description: srvDesc.value,
          mileage: Number(srvMileageInput.value),
          cost: Number(srvCostInput.value),
          attachmentUrl: attachmentUrl 
        };

        const validatedData = validateServiceRecordData(rawData);
        const finalData = cleanData(validatedData);

        const res = await updateServiceRecord(state.editServiceId, finalData);
        if (res.ok) {
          if (rawData.mileage > currentMileage) {
               await syncVehicleMileage(state.currentVehicleId, rawData.mileage);
               state.currentVehicleMileage = rawData.mileage;
               loadVehicles();
          }
          showNotification("Zaktualizowano wpis", "success");
          clearInputs('view-edit-service'); 
          showView('view-vehicle-details');
          loadServiceRecords();
        } else {
          showNotification("Błąd: " + res.error.message, "error");
        }
      } catch (error) {
        showNotification(error.message, "error");
      } finally {
        updateBtn.innerText = "Zapisz zmiany";
        updateBtn.disabled = false;
      }
    };
  }
}
