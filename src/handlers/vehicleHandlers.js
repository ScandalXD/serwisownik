import { getVehicles, addVehicle, deleteVehicle, updateVehicle } from '../services/vehicleService.js';
import { el, clear } from '../domHelpers.js';
import { showView, resetTabs, clearInputs } from '../uiUtils.js';
import { state } from '../state.js';
import { loadFuelRecords } from './fuelHandlers.js';
import { validateVehicleData } from '../validators.js';

let currentEditingId = null;

// Ikony
function createIcon(paths, size = 16) {
  const pathArray = Array.isArray(paths) ? paths : [paths];
  
  const span = document.createElement('span');
  span.className = 'icon-wrapper'; 
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
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

// Pobieranie i wyświetlanie listy pojazdów
export async function loadVehicles() {
  const list = document.getElementById('vehicles-list');
  if (!list) return;
  clear(list);

  const res = await getVehicles();
  
  if (res.ok && res.data.length > 0) {
    res.data.forEach(veh => {      

      // Przycisk usuń
      const closeIcon = createIcon("M18 6L6 18M6 6l12 12", 16);
      const closeBtn = el('button', {
        className: 'btn-close',
        onclick: async (e) => {
          e.stopPropagation();
          await handleVehicleDelete(veh.id);
        }
      }, [closeIcon]);

      // Przycisk edytuj
      const editIcon = createIcon("M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z", 16);
      const editBtn = el('button', {
        className: 'btn-edit',
        onclick: (e) => {
          e.stopPropagation();
          handleVehicleEdit(veh);
        }
      }, [editIcon]);

      // Miniaturka
      let thumbEl;
      if (veh.photoUrl) {
        thumbEl = el('img', { 
          src: veh.photoUrl, 
          className: 'vehicle-thumb', 
          alt: `${veh.brand} ${veh.model}` 
        });
      } else {
        const carIcon = createIcon("M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z", 24);         
        thumbEl = el('div', { className: 'vehicle-thumb vehicle-thumb-placeholder' }, [carIcon]);
      }

      // Dane tekstowe
      const infoDiv = el('div', { className: 'vehicle-info' }, [
        el('h3', {}, [`${veh.brand} ${veh.model}`]),
        el('p', {}, [`Przebieg: ${veh.currentMileage} km | Rok: ${veh.year}`])
      ]);

      const contentDiv = el('div', { className: 'vehicle-card-content' }, [
        thumbEl,
        infoDiv
      ]);

      const li = el('li', { 
        className: 'vehicle-card',
        onclick: () => openVehicleDetails(veh)
      }, [
        contentDiv,
        editBtn,
        closeBtn
      ]);
      
      list.appendChild(li);
    });
  } else {
    list.appendChild(el('p', { className: 'empty-state' }, ['Twój garaż jest pusty.']));
  }
}


/* Formularz edycji */
function handleVehicleEdit(veh) {
  currentEditingId = veh.id;
  
  document.getElementById('edit-veh-brand').value = veh.brand || '';
  document.getElementById('edit-veh-model').value = veh.model || '';
  document.getElementById('edit-veh-year').value = veh.year || '';
  document.getElementById('edit-veh-mileage').value = veh.currentMileage || '';
  
  const fileInput = document.getElementById('edit-veh-photo');
  if (fileInput) fileInput.value = '';

  const removePhotoCheckbox = document.getElementById('edit-veh-remove-photo');
  const removePhotoContainer = document.getElementById('edit-veh-remove-photo-container');
  
  if (removePhotoCheckbox && removePhotoContainer) {
    removePhotoCheckbox.checked = false;
    removePhotoContainer.style.display = (veh.photoUrl) ? 'flex' : 'none'; 
  }
  
  showView('view-edit-vehicle');
}

/* Potwierdzenie usuniącia pojazdu */
async function handleVehicleDelete(vehicleId) {
  if (confirm("Czy na pewno chcesz usunąć ten pojazd? Stracisz bezpowrotnie całą jego historię!")) {
    const res = await deleteVehicle(vehicleId);
    if (res.ok) {
      loadVehicles();
    } else {
      alert("Błąd podczas usuwania: " + res.error.message);
    }
  }
}


 /* Widok szczegółów wybranego pojazdu */
async function openVehicleDetails(vehicle) {
  state.currentVehicleId = vehicle.id;
  document.getElementById('detail-title').textContent = `${vehicle.brand} ${vehicle.model}`;
  
  resetTabs();
  document.getElementById('tab-fuel').classList.add('active');
  document.getElementById('btn-show-add-fuel').style.display = 'block';
  
  loadFuelRecords();
  showView('view-vehicle-details');
}

export function initVehicleHandlers() {
  const goAddBtn = document.getElementById('btn-go-add-vehicle');
  if (goAddBtn) goAddBtn.onclick = () => showView('view-add-vehicle');

  // Zapis pojazdu
  const saveBtn = document.getElementById('btn-save-vehicle');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Zapisywanie...";
        
        const rawData = {
          brand: document.getElementById('veh-brand').value,
          model: document.getElementById('veh-model').value,
          year: document.getElementById('veh-year').value,
          currentMileage: document.getElementById('veh-mileage').value
        };

        const fileInput = document.getElementById('veh-photo');
        const photoFile = (fileInput && fileInput.files.length > 0) ? fileInput.files[0] : null;

        const validatedData = validateVehicleData(rawData);
        const res = await addVehicle(validatedData, photoFile);

        if (res.ok) {
          clearInputs('view-add-vehicle');
          if (fileInput) fileInput.value = '';
          loadVehicles();
          showView('view-dashboard');
        } else {
          alert("Błąd bazy danych: " + res.error.message);
        }
      } catch (error) {
        alert(error.message); 
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Zapisz pojazd";
      }
    };
  }

  // Edycja pojazdu
  const updateBtn = document.getElementById('btn-update-vehicle');
  if (updateBtn) {
    updateBtn.onclick = async () => {
      try {
        updateBtn.disabled = true;
        updateBtn.textContent = "Zapisywanie...";
        
        const rawData = {
          brand: document.getElementById('edit-veh-brand').value,
          model: document.getElementById('edit-veh-model').value,
          year: document.getElementById('edit-veh-year').value,
          currentMileage: document.getElementById('edit-veh-mileage').value
        };

        const fileInput = document.getElementById('edit-veh-photo');
        const photoFile = (fileInput && fileInput.files.length > 0) ? fileInput.files[0] : null;
        
        // Sprawdzenie, czy użytkownik chce usunąć dotychczasową miniaturkę
        const removePhotoCheckbox = document.getElementById('edit-veh-remove-photo');
        const isPhotoRemoved = removePhotoCheckbox ? removePhotoCheckbox.checked : false;

        const validatedData = validateVehicleData(rawData);
        const res = await updateVehicle(currentEditingId, validatedData, photoFile, isPhotoRemoved);

        if (res.ok) {
          if (fileInput) fileInput.value = '';
          loadVehicles();
          showView('view-dashboard');
        } else {
          alert("Błąd podczas aktualizacji: " + res.error.message);
        }
      } catch (error) {
        alert(error.message);
      } finally {
        updateBtn.disabled = false;
        updateBtn.textContent = "Zapisz zmiany";
      }
    };
  }
}
