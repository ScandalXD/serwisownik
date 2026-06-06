import { getServiceRecordsByVehicle, addServiceRecord, deleteServiceRecord, updateServiceRecord } from '../services/serviceRecordService.js';
import { syncVehicleMileage } from '../services/vehicleService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs, showNotification, showConfirm, showFieldError, clearFieldErrors } from '../uiUtils.js';
import { validateServiceRecordData } from '../validators.js';
import { storage, auth } from '../firebase.js'; 
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { loadVehicles } from './vehicleHandlers.js'; 

// Obsługa czasu wysyłania załącznika
const uploadWithTimeout = (storageRef, file, timeoutMs = 7000) => {
    return Promise.race([
        uploadBytes(storageRef, file),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Przekroczono czas wsyłania załącznika (sprawdź internet)")), timeoutMs))
    ]);
};

function cleanData(obj) {
    const clean = {};
    for (const key in obj) {
        if (obj[key] !== undefined) clean[key] = obj[key];
    }
    return clean;
}

function validateForm(descEl, mileageEl, costEl, currentMileage, isEdit = false) {
    clearFieldErrors(); 
    let isValid = true;
    if (!descEl.value.trim()) { showFieldError(descEl, "Opis serwisu jest wymagany."); isValid = false; }
    const mileage = Number(mileageEl.value);
    if (mileage <= 0) { showFieldError(mileageEl, "Przebieg musi być większy od 0."); isValid = false; }
    else if (!isEdit && currentMileage > 0 && mileage < currentMileage) { showFieldError(mileageEl, `Przebieg nie może być mniejszy niż aktualny (${currentMileage} km).`); isValid = false; }
    if (costEl.value === "" || Number(costEl.value) < 0) { showFieldError(costEl, "Podaj poprawny koszt (min. 0)."); isValid = false; }
    return isValid;
}

// Ładowanie
export async function loadServiceRecords() {
    const list = document.getElementById('records-list');
    if (!list || !document.getElementById('tab-service')?.classList.contains('active')) return;
    
    if (!state.currentVehicleId) return;

    const res = await getServiceRecordsByVehicle(state.currentVehicleId);
    if (!document.getElementById('tab-service')?.classList.contains('active')) return;
    
    clear(list); 
    let data = res.ok ? res.data : [];

    state.deletedServiceIds = state.deletedServiceIds || [];
    data = data.filter(r => !state.deletedServiceIds.includes(r.id));
    state.updatedServiceRecords = state.updatedServiceRecords || {};
    data = data.map(r => state.updatedServiceRecords[r.id] ? { ...r, ...state.updatedServiceRecords[r.id] } : r);
    
    state.pendingServiceRecords = state.pendingServiceRecords || [];
    const pending = state.pendingServiceRecords.filter(r => r.vehicleId === state.currentVehicleId);
    const existing = new Set(data.map(d => `${d.date}_${d.mileage}_${d.description}`));
    pending.forEach(p => { if (!existing.has(`${p.date}_${p.mileage}_${p.description}`)) data.push(p); });

    if (data.length > 0) {
        data.sort((a, b) => (new Date(b.date) - new Date(a.date)) || ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        
        const fragment = document.createDocumentFragment();
        data.forEach(r => {
            const li = el('li', {}, [
                el('div', { className: 'record-row' }, [
                    el('div', {}, [
                        el('h3', {}, [`${r.description} ${r.isPending ? '(Zapisane lokalnie)' : ''}`]),            
                        el('p', {}, [`Koszt: ${r.cost} PLN`]),
                        el('p', { className: 'record-meta' }, [`Data: ${r.date}`]),
                        el('p', { className: 'record-meta' }, [`Przebieg: ${r.mileage} km`]),           
                        r.attachmentUrl ? el('a', { href: r.attachmentUrl, target: '_blank', className: 'attachment-link' }, ['Zobacz załącznik']) : ''
                    ]),
                    el('div', { className: 'actions-vertical' }, [
                        el('button', { className: 'small secondary', onclick: () => startEdit(r) }, ['Edytuj']),
                        el('button', { className: 'small secondary danger-text', onclick: () => remove(r.id) }, ['Usuń'])
                    ])
                ])
            ]);
            fragment.appendChild(li);
        });
        list.appendChild(fragment);
    } else { 
        list.appendChild(el('p', { className: 'empty-state' }, ['Brak wpisów serwisowych.'])); 
    }
}

function startEdit(r) {
    clearFieldErrors();
    state.editServiceId = r.id;
    state.editServiceAttachmentUrl = r.attachmentUrl || null; 
    document.getElementById('edit-srv-date').value = r.date;
    document.getElementById('edit-srv-desc').value = r.description;
    document.getElementById('edit-srv-mileage').value = r.mileage;
    document.getElementById('edit-srv-cost').value = r.cost;
    
    // Ładowanie podglądu zdjęcia
    const container = document.getElementById('edit-srv-remove-file-container');
    const checkbox = document.getElementById('edit-srv-remove-file');
    const previewImg = document.getElementById('edit-srv-preview-img');
    
    if (checkbox) checkbox.checked = false;
    if (container) {
        if (r.attachmentUrl) {
            container.style.display = 'flex';
            if (previewImg) previewImg.src = r.attachmentUrl;
        } else {
            container.style.display = 'none';
        }
    }
    
    showView('view-edit-service');
}

// Usuwanie wpisu offline
async function remove(id) {
    if (!navigator.onLine) {
        showNotification("Brak internetu. Nie można usunąć wpisu w trybie offline.", "error");
        return;
    }

    showConfirm("Czy na pewno usunąć?", () => {
        state.deletedServiceIds = (state.deletedServiceIds || []).concat(id);
        deleteServiceRecord(id).catch(e => console.error(e));
        loadServiceRecords();
    });
}

// Usuwanie załącznika
export function initServiceHandlers() {
    document.getElementById('btn-remove-current-srv-photo')?.addEventListener('click', () => {
    const container = document.getElementById('edit-srv-remove-file-container');
    
    if (!navigator.onLine) {
        showFieldError(container, "Brak internetu. Usuwanie załącznika wymaga połączenia.");
        return;
    }
    
    showConfirm("Czy na pewno chcesz usunąć ten załącznik?", () => {
        clearFieldErrors();
        container.style.display = 'none';
        const checkbox = document.getElementById('edit-srv-remove-file');
        if (checkbox) checkbox.checked = true;
      });
    });

    const addBtn = document.getElementById('btn-show-add-service');
    if(addBtn) {
        addBtn.onclick = () => {
            clearFieldErrors(); 
            document.getElementById('srv-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('srv-file').value = '';
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
            const fileInput = document.getElementById('srv-file');
            const file = fileInput.files[0];

            if (!validateForm(srvDesc, srvMileageInput, srvCostInput, currentMileage, false)) return;

            if (file && !navigator.onLine) {
                showFieldError(fileInput, "Brak internetu. Usuwanie załącznika wymaga połączenia.");
                return;
            }

            saveBtn.disabled = true; saveBtn.innerText = "Zapisywanie...";
            
            try {
                let attachmentUrl = null;
                if (file) {
                    const snap = await uploadWithTimeout(ref(storage, `service_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`), file);
                    attachmentUrl = await getDownloadURL(snap.ref);
                }

                const rawData = { vehicleId: state.currentVehicleId, date: document.getElementById('srv-date').value, description: srvDesc.value, mileage: Number(srvMileageInput.value), cost: Number(srvCostInput.value), attachmentUrl };
                const localData = { ...rawData, id: 'temp-' + Date.now(), isPending: true };
                
                state.pendingServiceRecords = (state.pendingServiceRecords || []).concat(localData);
                clearInputs('view-add-service');
                showView('view-vehicle-details');
                loadServiceRecords();
                
                addServiceRecord(cleanData(validateServiceRecordData(rawData))).then((res) => {
                    if(res.ok) {
                        state.pendingServiceRecords = state.pendingServiceRecords.filter(r => r.id !== localData.id);
                        if (rawData.mileage > currentMileage) { syncVehicleMileage(state.currentVehicleId, rawData.mileage).catch(e => console.error(e)); loadVehicles(); }
                        loadServiceRecords();
                    }
                });
                showNotification("Zapisano", "success");
            } catch (err) {
                showNotification("Błąd: " + err.message, "error");
            } finally { saveBtn.innerText = "Zapisz wpis"; saveBtn.disabled = false; }
        };
    }

    const updateBtn = document.getElementById('btn-update-service');
    if(updateBtn) {
        updateBtn.onclick = async () => {
            const srvDesc = document.getElementById('edit-srv-desc');
            const srvMileageInput = document.getElementById('edit-srv-mileage');
            const srvCostInput = document.getElementById('edit-srv-cost');
            const currentMileage = Number(state.currentVehicleMileage || 0);
            const fileInput = document.getElementById('edit-srv-file');
            const file = fileInput.files[0];
            const removeCheckbox = document.getElementById('edit-srv-remove-file');

            if (!validateForm(srvDesc, srvMileageInput, srvCostInput, currentMileage, true)) return;

            if (file && !navigator.onLine) {
                showFieldError(fileInput, "Brak internetu. Dodawanie załącznika wymaga połączenia.");
                return;
            }

            updateBtn.disabled = true; updateBtn.innerText = "Zapisywanie...";
            try {
                let attachmentUrl = state.editServiceAttachmentUrl;
                
                if (removeCheckbox && removeCheckbox.checked) {
                    attachmentUrl = null; 
                } else if (file) {
                    const snap = await uploadWithTimeout(ref(storage, `service_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`), file);
                    attachmentUrl = await getDownloadURL(snap.ref);
                }

                const rawData = { vehicleId: state.currentVehicleId, date: document.getElementById('edit-srv-date').value, description: srvDesc.value, mileage: Number(srvMileageInput.value), cost: Number(srvCostInput.value), attachmentUrl };
                state.updatedServiceRecords = state.updatedServiceRecords || {};
                state.updatedServiceRecords[state.editServiceId] = { ...rawData, id: state.editServiceId, isPending: true };
                
                showView('view-vehicle-details');
                loadServiceRecords();
                
                updateServiceRecord(state.editServiceId, cleanData(validateServiceRecordData(rawData))).then(() => {
                    delete state.updatedServiceRecords[state.editServiceId];
                    loadServiceRecords();
                });
                showNotification("Zaktualizowano", "success");
            } catch (err) {
                showNotification("Błąd: " + err.message, "error");
            } finally { updateBtn.innerText = "Zapisz zmiany"; updateBtn.disabled = false; }
        };
    }
}
