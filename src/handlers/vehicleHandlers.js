import { getVehicles, addVehicle, deleteVehicle, updateVehicle } from '../services/vehicleService.js';
import { el, clear } from '../domHelpers.js';
import { showView, resetTabs, clearInputs, showNotification, showConfirm, showFieldError, clearFieldErrors } from '../uiUtils.js';
import { state } from '../state.js';
import { loadFuelRecords } from './fuelHandlers.js';
import { validateVehicleData } from '../validators.js';

let currentEditingId = null;
let currentEditingMileage = 0;

// Walidacja
function validateVehicleForm(brandEl, modelEl, yearEl, mileageEl, minMileage = 0, isEditing = false) {
  clearFieldErrors();
  let isValid = true;
  const currentYear = new Date().getFullYear() + 1;

  if (!brandEl.value.trim()) { 
      showFieldError(brandEl, "Marka jest wymagana."); 
      isValid = false; 
  }
  
  if (!modelEl.value.trim()) { 
      showFieldError(modelEl, "Model jest wymagany."); 
      isValid = false; 
  }
  
  const year = Number(yearEl.value);
  if (!yearEl.value) { 
      showFieldError(yearEl, "Rok jest wymagany."); 
      isValid = false; 
  } else if (year < 1900 || year > currentYear) {
      showFieldError(yearEl, `Rok musi być pomiędzy 1900 a ${currentYear}.`); 
      isValid = false; 
  }
  
  const mileage = Number(mileageEl.value);
  if (mileageEl.value === "" || mileage < 0) {
      showFieldError(mileageEl, "Podaj poprawny przebieg (min. 0).");
      isValid = false;
  } 
  else if (!isEditing && minMileage > 0 && mileage < minMileage) {
      showFieldError(mileageEl, `Przebieg nie może być niższy niż poprzedni (${minMileage} km).`);
      isValid = false;
  }
  
  return isValid;
}

// Ikona
function createIcon(paths, size = 16) {
  const pathArray = Array.isArray(paths) ? paths : [paths];
  const span = document.createElement('span');
  span.className = 'icon-wrapper'; 
  span.style.width = `${size}px`; span.style.height = `${size}px`;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
  svg.classList.add('icon-svg');
  svg.setAttribute("stroke-width", "2"); 
  pathArray.forEach(d => {
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });
  span.appendChild(svg);
  return span;
}

// Ładowanie listy pojazdów
export async function loadVehicles() {
  const list = document.getElementById('vehicles-list');
  if (!list) return;
  clear(list);

  const res = await getVehicles();
  if (res.ok && res.data.length > 0) {
    res.data.forEach(veh => { 
      const closeIcon = createIcon("M18 6L6 18M6 6l12 12", 16);
      const closeBtn = el('button', { className: 'btn-close', onclick: async (e) => { e.stopPropagation(); await handleVehicleDelete(veh.id); } }, [closeIcon]);
      const editIcon = createIcon("M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z", 16);
      const editBtn = el('button', { className: 'btn-edit', onclick: (e) => { e.stopPropagation(); handleVehicleEdit(veh); } }, [editIcon]);

      let thumbEl = veh.photoUrl 
        ? el('img', { src: veh.photoUrl, className: 'vehicle-thumb', alt: `${veh.brand} ${veh.model}` })
        : el('div', { className: 'vehicle-thumb vehicle-thumb-placeholder' }, [createIcon("M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z", 24)]);

      const li = el('li', { className: 'vehicle-card', onclick: () => openVehicleDetails(veh) }, [
        el('div', { className: 'vehicle-card-content' }, [thumbEl, el('div', { className: 'vehicle-info' }, [el('h3', {}, [`${veh.brand} ${veh.model}`]), el('p', {}, [`Przebieg: ${veh.currentMileage} km | Rok: ${veh.year}`])])]),
        editBtn, closeBtn
      ]);
      list.appendChild(li);
    });
  } else {
    list.appendChild(el('p', { className: 'empty-state' }, ['Twój garaż jest pusty.']));
  }
}

// Przygotowanie formularza edycji pojazdu
function handleVehicleEdit(veh) {
  clearFieldErrors();
  
  const existingWarning = document.getElementById('mileage-warning');
  if (existingWarning) existingWarning.remove();

  currentEditingId = veh.id;
  currentEditingMileage = Number(veh.currentMileage);
  document.getElementById('edit-veh-brand').value = veh.brand || '';
  document.getElementById('edit-veh-model').value = veh.model || '';
  document.getElementById('edit-veh-year').value = veh.year || '';
  document.getElementById('edit-veh-mileage').value = veh.currentMileage || '';
  
  const mileageInput = document.getElementById('edit-veh-mileage');
  const warning = el('div', { id: 'mileage-warning', className: 'warning-box' }, [
      "Uwaga: zmiana przebiegu wpłynie na wyliczenia spalania dla historycznych tankowań."
  ]);
  mileageInput.parentNode.insertBefore(warning, mileageInput.nextSibling);
  
  const fileInput = document.getElementById('edit-veh-photo');
  if (fileInput) fileInput.value = '';
  
  const container = document.getElementById('edit-veh-remove-photo-container');
  const checkbox = document.getElementById('edit-veh-remove-photo');
  const previewImg = document.getElementById('edit-veh-preview-img');
  
  if (checkbox) checkbox.checked = false; 
  if (container) {
      if (veh.photoUrl) {
          container.style.display = 'flex';
          if (previewImg) previewImg.src = veh.photoUrl;
      } else {
          container.style.display = 'none';
      }
  }
  
  showView('view-edit-vehicle');
}

// Potwierdzenie usuwania pojazdu
async function handleVehicleDelete(vehicleId) {

  if (!navigator.onLine) {
    showNotification("Brak połączenia z internetem. Usunięcie pojazdu nie jest możliwe w trybie offline.", "error");
    return;
  }

  showConfirm("Czy na pewno chcesz usunąć ten pojazd? Stracisz bezpowrotnie całą historię.", async () => {
    const res = await deleteVehicle(vehicleId);
    if (res.ok) {
      showNotification("Pojazd usunięty", "info");
      loadVehicles();
    } else {
      showNotification("Błąd: " + res.error.message, "error");
    }
  });
}

// Przygotowanie szczegółów pojazdu
async function openVehicleDetails(vehicle) {
  state.currentVehicleId = vehicle.id;
  state.currentVehicleMileage = vehicle.currentMileage; 
  document.getElementById('detail-title').textContent = `${vehicle.brand} ${vehicle.model}`;
  resetTabs();
  document.getElementById('tab-fuel').classList.add('active');
  document.getElementById('btn-show-add-fuel').style.display = 'block';
  loadFuelRecords();
  showView('view-vehicle-details');
}

// Konfiguracja interfejsu zarządzania pojazdami
export function initVehicleHandlers() {
  ['veh-year', 'veh-mileage', 'edit-veh-year', 'edit-veh-mileage'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (!['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'].includes(e.key) && !/^[0-9.]$/.test(e.key)) e.preventDefault();
    });
  });

  document.getElementById('btn-go-add-vehicle')?.addEventListener('click', () => {
    clearFieldErrors();
    clearInputs('view-add-vehicle');
    showView('view-add-vehicle');
  });

  // Usuwanie zdjęcia pojazdu
  document.getElementById('btn-remove-current-photo')?.addEventListener('click', () => {
    const container = document.getElementById('edit-veh-remove-photo-container');
    
    if (!navigator.onLine) {
        showFieldError(container, "Brak internetu. Usuwanie zdjęcia wymaga połączenia.");
        return;
    }
    
    showConfirm("Czy na pewno chcesz usunąć to zdjęcie?", () => {
        clearFieldErrors();
        container.style.display = 'none';
        const checkbox = document.getElementById('edit-veh-remove-photo');
        if (checkbox) checkbox.checked = true;
    });
});


  // Dodawanie pojazdu
  document.getElementById('btn-save-vehicle')?.addEventListener('click', async () => {
    const b = document.getElementById('veh-brand'), m = document.getElementById('veh-model'), y = document.getElementById('veh-year'), mi = document.getElementById('veh-mileage');
    const fileInput = document.getElementById('veh-photo');
    const file = fileInput?.files[0] || null;
    
    if (!validateVehicleForm(b, m, y, mi, 0, false)) return;
    
    if (file && !navigator.onLine) {
        showFieldError(fileInput, "Brak internetu. Usuń zdjęcie, aby zapisać pojazd w trybie offline.");
        return;
    }
    
    try {
      const btn = document.getElementById('btn-save-vehicle');
      btn.disabled = true; btn.textContent = "Zapisywanie...";
      
      const res = await addVehicle(validateVehicleData({ brand: b.value, model: m.value, year: y.value, currentMileage: mi.value }), file);
      
      if (res.ok) { 
          clearInputs('view-add-vehicle'); 
          loadVehicles(); 
          showView('view-dashboard'); 
          showNotification("Pojazd dodany", "success"); 
      } else {
          showNotification("Błąd: " + res.error.message, "error");
      }
    } catch (e) { 
        showNotification(e.message, "error"); 
    } finally { 
        document.getElementById('btn-save-vehicle').disabled = false; 
        document.getElementById('btn-save-vehicle').textContent = "Zapisz pojazd"; 
    }
  });

  // Edycja pojazdu
  document.getElementById('btn-update-vehicle')?.addEventListener('click', async () => {
    const b = document.getElementById('edit-veh-brand'), m = document.getElementById('edit-veh-model'), y = document.getElementById('edit-veh-year'), mi = document.getElementById('edit-veh-mileage');
    
    const fileInput = document.getElementById('edit-veh-photo');
    const file = fileInput?.files[0] || null;
    
    const removeCheckbox = document.getElementById('edit-veh-remove-photo');
    const isRemoved = removeCheckbox?.checked || false;
    
    if (!validateVehicleForm(b, m, y, mi, currentEditingMileage, true)) return;
    
    if (file && !navigator.onLine) {
        showFieldError(fileInput, "Brak internetu. Usuń nowe zdjęcie, aby zaktualizować dane.");
        return;
    }
    
    try {
      const btn = document.getElementById('btn-update-vehicle');
      btn.disabled = true; btn.textContent = "Zapisywanie...";
      
      const res = await updateVehicle(currentEditingId, validateVehicleData({ brand: b.value, model: m.value, year: y.value, currentMileage: mi.value }), file, isRemoved);
      
      if (res.ok) {
        state.currentVehicleMileage = Number(mi.value); 
        currentEditingMileage = Number(mi.value);
        loadVehicles(); 
        showView('view-dashboard'); 
        showNotification("Zapisano zmiany", "success");
      } else {
        showNotification("Błąd: " + res.error.message, "error");
      }
    } catch (e) { 
        showNotification(e.message, "error"); 
    } finally { 
        document.getElementById('btn-update-vehicle').disabled = false; 
        document.getElementById('btn-update-vehicle').textContent = "Zapisz zmiany"; 
    }
  });
}
