import { getRemindersByVehicle, addReminder, deleteReminder, updateReminder } from '../services/reminderService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs } from '../uiUtils.js';
import { validateReminderData, validateReminderUpdateData } from '../validators.js';

// Pobieranie i wyświetlanie listy przypomnień dla wybranego pojazdu
export async function loadReminders() {
  const list = document.getElementById('records-list');
  clear(list);
  const res = await getRemindersByVehicle(state.currentVehicleId);

  if (res.ok && res.data.length > 0) {
    res.data.forEach(r => {
      const info = (r.dueDate ? `Data: ${r.dueDate} ` : "") + (r.dueMileage ? `| Przebieg: ${r.dueMileage} km` : "");
      
      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [r.title]),
            el('p', {}, [info])
          ]),
          el('div', { className: 'actions-vertical' }, [
            el('button', { className: 'small secondary', onclick: () => startEdit(r) }, ['Edytuj']),
            el('button', { className: 'small secondary danger-text', onclick: () => remove(r.id) }, ['Usuń'])
          ])
        ])
      ]);
      list.appendChild(li);
    });
  } else { 
    list.appendChild(el('p', { className: 'empty-state' }, ['Brak przypomnień.'])); 
  }
}

// Wypełnianie formularza edycji danymi z wybranego przypomnienia
function startEdit(r) {
  state.editReminderId = r.id;
  document.getElementById('edit-rem-title').value = r.title;
  document.getElementById('edit-rem-date').value = r.dueDate || '';
  document.getElementById('edit-rem-mileage').value = r.dueMileage || '';
  showView('view-edit-reminder');
}

// Usuwanie przypomnienia
async function remove(id) {
  if (confirm("Czy na pewno usunąć to przypomnienie?")) {
    await deleteReminder(id);
    loadReminders();
  }
}

export function initReminderHandlers() {
  
  // Otwieranie czystego formularza do dodania nowego przypomnienia
  document.getElementById('btn-show-add-reminder').onclick = () => {
    clearInputs('view-add-reminder'); 
    showView('view-add-reminder');
  };

  // Zapisywanie nowego przypomnienia
  document.getElementById('btn-save-reminder').onclick = async () => {
    try {
      const rawData = {
        vehicleId: state.currentVehicleId,
        title: document.getElementById('rem-title').value,
        dueDate: document.getElementById('rem-date').value || null,
        dueMileage: document.getElementById('rem-mileage').value || null,
        isActive: true
      };

      const validatedData = validateReminderData(rawData);
      const res = await addReminder(validatedData);

      if (res.ok) {
        clearInputs('view-add-reminder');
        showView('view-vehicle-details');
        loadReminders();
      } else {
        alert("Błąd serwera: " + res.error.message);
      }
    } catch (error) {
      alert(error.message); 
    }
  };

  // Zapisywanie zmian w edytowanym przypomnieniu
  document.getElementById('btn-update-reminder').onclick = async () => {
    try {
      const rawData = {
        title: document.getElementById('edit-rem-title').value,
        dueDate: document.getElementById('edit-rem-date').value || null,
        dueMileage: document.getElementById('edit-rem-mileage').value || null
      };

      const validatedData = validateReminderUpdateData(rawData);
      const res = await updateReminder(state.editReminderId, validatedData);
      
      if (res.ok) {
        clearInputs('view-edit-reminder'); 
        showView('view-vehicle-details');
        loadReminders();
      } else {
        alert("Błąd aktualizacji: " + res.error.message);
      }
    } catch (error) {
      alert(error.message);
    }
  };
}