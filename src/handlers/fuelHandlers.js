import { getFuelRecordsByVehicle, addFuelRecord, deleteFuelRecord, updateFuelRecord } from '../services/fuelRecordService.js';
import { syncVehicleMileage } from '../services/vehicleService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs, showNotification, showConfirm, showFieldError, clearFieldErrors } from '../uiUtils.js';
import { validateFuelRecordData } from '../validators.js';
import { storage, auth } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { loadVehicles } from './vehicleHandlers.js';

// Obsługa czasu wysyłania załącznika
const uploadWithTimeout = (storageRef, file, timeoutMs = 7000) => {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error("Przekroczono czas wysyłania (sprawdź internet)"));
        }, timeoutMs);
    });

    return Promise.race([
        uploadBytes(storageRef, file).then((res) => {
            clearTimeout(timeoutId); 
            return res;
        }),
        timeoutPromise
    ]);
};

function validateForm(dateEl, mileageEl, litersEl, costEl, currentMileage, isEdit = false) {
    clearFieldErrors(); let isValid = true;
    if (!dateEl.value) { showFieldError(dateEl, "Data jest wymagana."); isValid = false; }
    const mileage = Number(mileageEl.value);
    if (mileage <= 0) { showFieldError(mileageEl, "Przebieg musi być większy od 0."); isValid = false; } 
    else if (!isEdit && currentMileage > 0 && mileage <= currentMileage) { showFieldError(mileageEl, `Przebieg musi być większy niż aktualny (${currentMileage} km).`); isValid = false; }
    if (Number(litersEl.value) <= 0) { showFieldError(litersEl, "Wpisz poprawną ilość litrów."); isValid = false; }
    if (costEl.value === "" || Number(costEl.value) < 0) { showFieldError(costEl, "Podaj poprawny koszt całkowity."); isValid = false; }
    return isValid;
}

// Ikonka dla spalania
function createIcon(paths, size = 16) {
    const span = document.createElement('span');
    span.style.width = `${size}px`; span.style.height = `${size}px`;
    span.style.display = 'inline-flex';
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2"); 
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", paths);
    svg.appendChild(path);
    span.appendChild(svg);
    return span;
}

// Ładowanie listy tankowań oraz spalania
export async function loadFuelRecords() {
    const list = document.getElementById('records-list');
    if (!list || !document.getElementById('tab-fuel')?.classList.contains('active')) return;
    
    const res = await getFuelRecordsByVehicle(state.currentVehicleId);
    if (!document.getElementById('tab-fuel')?.classList.contains('active')) return;
    
    clear(list);
    let data = res.ok ? res.data : [];

    state.deletedFuelIds = state.deletedFuelIds || [];
    data = data.filter(r => !state.deletedFuelIds.includes(r.id));
    state.updatedFuelRecords = state.updatedFuelRecords || {};
    data = data.map(r => state.updatedFuelRecords[r.id] ? { ...r, ...state.updatedFuelRecords[r.id] } : r);
    
    state.pendingFuelRecords = state.pendingFuelRecords || [];
    const pending = state.pendingFuelRecords.filter(r => r.vehicleId === state.currentVehicleId);
    const existingKeys = new Set(data.map(d => `${d.date}_${d.mileage}_${d.liters}`));
    pending.forEach(p => { if (!existingKeys.has(`${p.date}_${p.mileage}_${p.liters}`)) data.push(p); });

    data.sort((a, b) => Number(a.mileage) - Number(b.mileage));

    // Obliczanie spalania
    for (let i = 0; i < data.length; i++) {
        if (i > 0) {
            const distance = Number(data[i].mileage) - Number(data[i-1].mileage);
            if (distance > 0) {
                data[i].consumption = ((Number(data[i].liters) / distance) * 100).toFixed(2);
            }
        }
    }

    const fragment = document.createDocumentFragment();
    if (data.length > 0) {
        data.sort((a, b) => (new Date(b.date) - new Date(a.date)) || ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))).forEach(r => {
            
            // Generowanie bloku tekstu ze spalaniem
            let consumptionEl = '';
            if (r.consumption) {
                consumptionEl = el('p', { className: 'consumption-text' }, [
                    createIcon("M13 2L3 14h9l-1 8 10-12h-9l1-8z", 14), 
                    `Spalanie: ${r.consumption} l/100km`
                ]);
            } else {
                consumptionEl = el('p', { className: 'consumption-text', style: 'color: #94a3b8; font-weight: 500;' }, [`Spalanie: --- (brak danych z poprzedniego wpisu)`]);
            }

            const li = el('li', {}, [el('div', { className: 'record-row' }, [
                el('div', {}, [
                    el('h3', {}, [`Data: ${r.date} ${r.isPending ? '(Zapisane lokalnie)' : ''}`]),
                    el('p', { className: 'record-meta' }, [`${r.cost} PLN | ${r.liters} L | Przebieg: ${r.mileage} km`]),
                    consumptionEl,
                    r.attachmentUrl ? el('a', { href: r.attachmentUrl, target: '_blank', className: 'attachment-link' }, ['Zobacz załącznik']) : ''
                ]),
                el('div', { className: 'actions-vertical' }, [
                    el('button', { className: 'small secondary', 'data-action': 'edit', 'data-id': r.id }, ['Edytuj']),
                    el('button', { className: 'small secondary danger-text', 'data-action': 'delete', 'data-id': r.id }, ['Usuń'])
                ])
            ])]);
            fragment.appendChild(li);
        });
        list.appendChild(fragment);
    } else { list.appendChild(el('p', { className: 'empty-state' }, ['Brak wpisów o tankowaniu.'])); }
}

// Inicjalizacja
export function initFuelHandlers() {
    document.addEventListener('click', async (e) => {
        if (e.target.closest('#btn-show-add-fuel')) {
            clearFieldErrors();
            document.getElementById('fuel-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('fuel-file').value = '';
            showView('view-add-fuel');
        }

        if (e.target.matches('[data-action="delete"]')) {
            const id = e.target.getAttribute('data-id');
            
            if (!navigator.onLine) {
                showNotification("Brak internetu. Nie można usunąć wpisu w trybie offline.", "error");
                return;
            }

            showConfirm("Czy na pewno usunąć?", () => {
                state.deletedFuelIds = (state.deletedFuelIds || []).concat(id);
                deleteFuelRecord(id).catch(e => console.error(e));
                loadFuelRecords();
            });
        }

        if (e.target.matches('[data-action="edit"]')) {
            const id = e.target.getAttribute('data-id');
            const res = await getFuelRecordsByVehicle(state.currentVehicleId);
            const r = res.data.find(x => x.id === id);
            if (r) {
                state.editFuelId = r.id; state.editFuelAttachmentUrl = r.attachmentUrl;
                document.getElementById('edit-fuel-date').value = r.date;
                document.getElementById('edit-fuel-mileage').value = r.mileage;
                document.getElementById('edit-fuel-liters').value = r.liters;
                document.getElementById('edit-fuel-cost').value = r.cost;
                
                // Ładowanie podglądu zdjęcia
                const container = document.getElementById('edit-fuel-remove-file-container');
                const checkbox = document.getElementById('edit-fuel-remove-file');
                const previewImg = document.getElementById('edit-fuel-preview-img');
                
                if (checkbox) checkbox.checked = false;
                if (container) {
                    if (r.attachmentUrl) {
                        container.style.display = 'flex';
                        if (previewImg) previewImg.src = r.attachmentUrl;
                    } else {
                        container.style.display = 'none';
                    }
                }
                
                showView('view-edit-fuel');
            }
        }
    });

    // Usuwanie załącznika z tankowania
    document.getElementById('btn-remove-current-fuel-photo')?.addEventListener('click', () => {
        const container = document.getElementById('edit-fuel-remove-file-container');
        if (!navigator.onLine) {
            showFieldError(container, "Brak internetu. Usuwanie załącznika wymaga połączenia.");
            return;
        }
        
        showConfirm("Czy na pewno chcesz usunąć ten załącznik?", () => {
            clearFieldErrors();
            container.style.display = 'none';
            const checkbox = document.getElementById('edit-fuel-remove-file');
            if (checkbox) checkbox.checked = true;
        });
    });

    // Zapisywanie nowego tankowania
    const saveBtn = document.getElementById('btn-save-fuel');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const fileInput = document.getElementById('fuel-file');
            const file = fileInput.files[0];
            const d = document.getElementById('fuel-date'), m = document.getElementById('fuel-mileage'), l = document.getElementById('fuel-liters'), c = document.getElementById('fuel-cost');
            
            if (!validateForm(d, m, l, c, Number(state.currentVehicleMileage))) return;
            
            if (file && !navigator.onLine) {
                showFieldError(fileInput, "Brak internetu. Usuń załącznik, żeby dodać wpis lokalnie.");
                return;
            }
            
            saveBtn.disabled = true; saveBtn.innerText = "Zapisywanie...";
            try {
                let attachmentUrl = null;
                if (file) {
                    const snap = await uploadWithTimeout(ref(storage, `fuel_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`), file);
                    attachmentUrl = await getDownloadURL(snap.ref);
                }

                const rawData = { vehicleId: state.currentVehicleId, date: d.value, mileage: Number(m.value), liters: Number(l.value), cost: Number(c.value), attachmentUrl };
                const localData = { ...rawData, id: 'temp-' + Date.now(), isPending: true };
                
                state.pendingFuelRecords = (state.pendingFuelRecords || []).concat(localData);
                clearInputs('view-add-fuel');
                showView('view-vehicle-details');
                loadFuelRecords();
                
                addFuelRecord(validateFuelRecordData(rawData)).then(() => {
                    state.pendingFuelRecords = state.pendingFuelRecords.filter(r => r.id !== localData.id);
                    loadFuelRecords();
                });
                showNotification("Zapisano", "success");
            } catch (err) {
                showNotification("Błąd: " + err.message, "error");
            } finally { 
                saveBtn.disabled = false; saveBtn.innerText = "Zapisz tankowanie"; 
            }
        };
    }

    // Zapisywanie edycji
    const updateBtn = document.getElementById('btn-update-fuel');
    if (updateBtn) {
        updateBtn.onclick = async () => {
            const fileInput = document.getElementById('edit-fuel-file');
            const file = fileInput.files[0];
            const d = document.getElementById('edit-fuel-date'), m = document.getElementById('edit-fuel-mileage'), l = document.getElementById('edit-fuel-liters'), c = document.getElementById('edit-fuel-cost');
            const removeCheckbox = document.getElementById('edit-fuel-remove-file');
            
            if (!validateForm(d, m, l, c, Number(state.currentVehicleMileage), true)) return;
            
            if (file && !navigator.onLine) {
                showFieldError(fileInput, "Brak internetu. Usuń nowy załącznik, żeby zapisać zmiany lokalnie.");
                return;
            }

            updateBtn.disabled = true; updateBtn.innerText = "Zapisywanie...";
            try {
                let attachmentUrl = state.editFuelAttachmentUrl;
                
                if (removeCheckbox && removeCheckbox.checked) {
                    attachmentUrl = null;
                } else if (file) {
                    const snap = await uploadWithTimeout(ref(storage, `fuel_receipts/${auth.currentUser.uid}/${Date.now()}_${file.name}`), file);
                    attachmentUrl = await getDownloadURL(snap.ref);
                }
                
                const rawData = { date: d.value, mileage: Number(m.value), liters: Number(l.value), cost: Number(c.value), attachmentUrl };
                state.updatedFuelRecords = state.updatedFuelRecords || {};
                state.updatedFuelRecords[state.editFuelId] = { ...rawData, id: state.editFuelId, isPending: true };
                
                showView('view-vehicle-details');
                loadFuelRecords();
                
                updateFuelRecord(state.editFuelId, validateFuelRecordData(rawData)).then(() => {
                    delete state.updatedFuelRecords[state.editFuelId];
                    loadFuelRecords();
                });
                showNotification("Zaktualizowano", "success");
            } catch (err) {
                showNotification("Błąd: " + err.message, "error");
            } finally { 
                updateBtn.disabled = false; updateBtn.innerText = "Zapisz zmiany"; 
            }
        };
    }
}
