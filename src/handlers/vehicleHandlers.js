import { getVehicles, addVehicle, deleteVehicle, updateVehicle } from '../services/vehicleService.js';
import { el, clear } from '../domHelpers.js';
import { showView, resetTabs, clearInputs } from '../uiUtils.js';
import { state } from '../state.js';
import { loadFuelRecords } from './fuelHandlers.js';
import { validateVehicleData } from '../validators.js';

let currentEditingId = null;

// Pobieranie i wyświetlanie listy pojazdów
export async function loadVehicles() {
  const list = document.getElementById('vehicles-list');
  if (!list) return;
  clear(list);

  const res = await getVehicles();
  
  if (res.ok && res.data.length > 0) {
    res.data.forEach(veh => {      

      const closeBtn = el('button', {
        className: 'btn-close',
        onclick: async (e) => {
          e.stopPropagation();
          await handleVehicleDelete(veh.id);
        }
      });
      closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

      const editBtn = el('button', {
        className: 'btn-close',
        style: 'right: 45px; color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent);',
        onclick: (e) => {
          e.stopPropagation();
          handleVehicleEdit(veh);
        }
      });
      editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;

      const li = el('li', { 
        className: 'vehicle-card',
        onclick: () => openVehicleDetails(veh)
      }, [
        el('div', {}, [
          el('h3', {}, [`${veh.brand} ${veh.model}`]),
          el('p', {}, [`Przebieg: ${veh.currentMileage} km | Rok: ${veh.year}`])
        ]),
        editBtn,
        closeBtn
      ]);
      
      list.appendChild(li);
    });
  } else {
    list.appendChild(el('p', { className: 'empty-state' }, ['Twój garaż jest pusty.']));
  }
}

function handleVehicleEdit(veh) {
  currentEditingId = veh.id;
  
  document.getElementById('edit-veh-brand').value = veh.brand;
  document.getElementById('edit-veh-model').value = veh.model;
  document.getElementById('edit-veh-year').value = veh.year;
  document.getElementById('edit-veh-mileage').value = veh.currentMileage;
  
  showView('view-edit-vehicle');
}

// Usuwanie pojazdu
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

// Otwieranie szczegółów auta
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
  if (goAddBtn) {
    goAddBtn.onclick = () => showView('view-add-vehicle');
  }

  // Zapisywanie nowego pojazdu
  const saveBtn = document.getElementById('btn-save-vehicle');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        const rawData = {
          brand: document.getElementById('veh-brand').value,
          model: document.getElementById('veh-model').value,
          year: document.getElementById('veh-year').value,
          currentMileage: document.getElementById('veh-mileage').value
        };

        const validatedData = validateVehicleData(rawData);
        const res = await addVehicle(validatedData);

        if (res.ok) {
          clearInputs('view-add-vehicle'); 
          loadVehicles();
          showView('view-dashboard');
        } else {
          alert("Błąd bazy danych: " + res.error.message);
        }
      } catch (error) {
        alert(error.message); 
      }
    };
  }

  // Zapis zmian podczas edycji
  const updateBtn = document.getElementById('btn-update-vehicle');
  if (updateBtn) {
    updateBtn.onclick = async () => {
      try {
        const rawData = {
          brand: document.getElementById('edit-veh-brand').value,
          model: document.getElementById('edit-veh-model').value,
          year: document.getElementById('edit-veh-year').value,
          currentMileage: document.getElementById('edit-veh-mileage').value
        };

        const validatedData = validateVehicleData(rawData);
        const res = await updateVehicle(currentEditingId, validatedData);

        if (res.ok) {
          loadVehicles();
          showView('view-dashboard');
        } else {
          alert("Błąd podczas aktualizacji: " + res.error.message);
        }
      } catch (error) {
        alert(error.message);
      }
    };
  }
}
