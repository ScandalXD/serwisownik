import { getRemindersByVehicle, addReminder, deleteReminder, updateReminder } from '../services/reminderService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs, showNotification, showConfirm, showFieldError, clearFieldErrors } from '../uiUtils.js';
import { validateReminderData, validateReminderUpdateData } from '../validators.js';


// Ładowanie listy przypomnień
export async function loadReminders() {
  const list = document.getElementById('records-list');
  if (!list) return;
  clear(list);
  const res = await getRemindersByVehicle(state.currentVehicleId);

  if (res.ok && res.data.length > 0) {
    const sortedData = res.data.sort((a, b) => {

      if (a.dueDate && b.dueDate) {
        const dateDiff = new Date(a.dueDate) - new Date(b.dueDate);
        if (dateDiff !== 0) return dateDiff;
      } 
      else if (a.dueDate && !b.dueDate) {
        return -1;
      } else if (!a.dueDate && b.dueDate) {
        return 1;
      }      
      const timeB = b.createdAt?.seconds || 0;
      const timeA = a.createdAt?.seconds || 0;
      return timeB - timeA; 
    });

    sortedData.forEach(r => {
      const parts = [];
      
      const dBefore = r.notifyDaysBefore !== undefined && r.notifyDaysBefore !== null ? r.notifyDaysBefore : 30;
      const kBefore = r.notifyKmBefore !== undefined && r.notifyKmBefore !== null ? r.notifyKmBefore : 1000;

      if (r.dueDate) parts.push(`Data: ${r.dueDate} (powiadomi ${dBefore} dni przed)`);
      if (r.dueMileage) parts.push(`Przebieg: ${r.dueMileage} km (powiadomi ${kBefore} km przed)`);
      const info = parts.join(' | ');
      
      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [r.title]),
            el('p', { className: 'reminder-info' }, [info])
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

// Zapisywanie edycji przypomnienia
function startEdit(r) {
  clearFieldErrors();

  state.editReminderId = r.id;
  document.getElementById('edit-rem-title').value = r.title;
  document.getElementById('edit-rem-date').value = r.dueDate || '';
  document.getElementById('edit-rem-mileage').value = r.dueMileage || '';
  
  const dayRadio = document.getElementById(`edit-rem-days-${r.notifyDaysBefore || '30'}`);
  if (dayRadio) dayRadio.checked = true;

  const kmRadio = document.getElementById(`edit-rem-km-${r.notifyKmBefore || '1000'}`);
  if (kmRadio) kmRadio.checked = true;

  showView('view-edit-reminder');
}

async function remove(id) {
  showConfirm("Czy na pewno chcesz usunąć to przypomnienie?", async () => {
    const res = await deleteReminder(id);
    if (res.ok) {
      showNotification("Przypomnienie usunięte", "info");
      loadReminders();
    } else {
      showNotification("Błąd: " + res.error.message, "error");
    }
  });
}

export function initReminderHandlers() {
  
  // Wizualana walidacja formularzy
  const validateReminder = (titleEl, dateEl, mileageEl) => {
    clearFieldErrors(); 
    let isValid = true;

    if (!titleEl.value.trim()) { 
        showFieldError(titleEl, "Tytuł jest wymagany."); 
        isValid = false; 
    }
    
    if (!dateEl.value && !mileageEl.value) { 
        showFieldError(dateEl, "Podaj datę lub przebieg."); 
        showFieldError(mileageEl, "Podaj datę lub przebieg."); 
        isValid = false; 
    }
    
    if (dateEl.value) {
      const today = new Date(); 
      today.setHours(0, 0, 0, 0);
      if (new Date(dateEl.value) < today) {
        showFieldError(dateEl, "Data nie może być z przeszłości."); 
        isValid = false;
      }
    }
    
    if (mileageEl.value && state.currentVehicleMileage !== undefined) {
      if (Number(mileageEl.value) <= state.currentVehicleMileage) {
        showFieldError(mileageEl, `Przebieg musi być większy niż aktualny (${state.currentVehicleMileage} km).`);
        isValid = false;
      }
    }
    
    return isValid;
  };

  document.getElementById('btn-show-add-reminder').onclick = () => {
    clearFieldErrors();
    clearInputs('view-add-reminder');
    document.getElementById('rem-days-30').checked = true;
    document.getElementById('rem-km-1000').checked = true;
    showView('view-add-reminder');
  };

  // Zapisywanie nowego przypomnienia
  document.getElementById('btn-save-reminder').onclick = async () => {
    const titleIn = document.getElementById('rem-title');
    const dateIn = document.getElementById('rem-date');
    const milIn = document.getElementById('rem-mileage');

    if (!validateReminder(titleIn, dateIn, milIn)) return;

    try {
      let finalDays = 30;
      if (document.getElementById('rem-days-7').checked) finalDays = 7;
      else if (document.getElementById('rem-days-14').checked) finalDays = 14;
      else if (document.getElementById('rem-days-30').checked) finalDays = 30;

      let finalKm = 1000;
      if (document.getElementById('rem-km-500').checked) finalKm = 500;
      else if (document.getElementById('rem-km-1000').checked) finalKm = 1000;
      else if (document.getElementById('rem-km-2000').checked) finalKm = 2000;

      const rawData = {
        vehicleId: state.currentVehicleId,
        vehicleName: document.getElementById('detail-title').textContent,
        title: titleIn.value,
        dueDate: dateIn.value || null,
        dueMileage: milIn.value || null,
        notifyDaysBefore: finalDays,
        notifyKmBefore: finalKm,
        isActive: true
      };

      const res = await addReminder(validateReminderData(rawData));
      if (res.ok) {
        showNotification("Zapisano przypomnienie", "success");
        clearInputs('view-add-reminder');
        showView('view-vehicle-details');
        loadReminders();
      } else {
        showNotification("Błąd: " + res.error.message, "error");
      }
    } catch (err) { showNotification(err.message, "error"); }
  };

  // Zapisywanie edycji przypomnienia
  document.getElementById('btn-update-reminder').onclick = async () => {
    const titleIn = document.getElementById('edit-rem-title');
    const dateIn = document.getElementById('edit-rem-date');
    const milIn = document.getElementById('edit-rem-mileage');

    if (!validateReminder(titleIn, dateIn, milIn)) return;

    try {
      let finalDays = 30;
      if (document.getElementById('edit-rem-days-7').checked) finalDays = 7;
      else if (document.getElementById('edit-rem-days-14').checked) finalDays = 14;
      else if (document.getElementById('edit-rem-days-30').checked) finalDays = 30;

      let finalKm = 1000;
      if (document.getElementById('edit-rem-km-500').checked) finalKm = 500;
      else if (document.getElementById('edit-rem-km-1000').checked) finalKm = 1000;
      else if (document.getElementById('edit-rem-km-2000').checked) finalKm = 2000;

      const rawData = {
        title: titleIn.value,
        dueDate: dateIn.value || null,
        dueMileage: milIn.value || null,
        notifyDaysBefore: finalDays,
        notifyKmBefore: finalKm,
      };

      const res = await updateReminder(state.editReminderId, validateReminderUpdateData(rawData));
      if (res.ok) {
        showNotification("Zaktualizowano", "success");
        showView('view-vehicle-details');
        loadReminders();
      } else {
        showNotification("Błąd: " + res.error.message, "error");
      }
    } catch (err) { showNotification(err.message, "error"); }
  };
}
