import { getRemindersByVehicle, addReminder, deleteReminder, updateReminder } from '../services/reminderService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs, showNotification, showConfirm, showFieldError, clearFieldErrors } from '../uiUtils.js';
import { validateReminderData, validateReminderUpdateData } from '../validators.js';

// Ładowanie listy przypomnień
export async function loadReminders() {
  const list = document.getElementById('records-list');
  if (!list || !document.getElementById('tab-reminder')?.classList.contains('active')) return;
  
  const res = await getRemindersByVehicle(state.currentVehicleId);
  
  if (!document.getElementById('tab-reminder')?.classList.contains('active')) return;
  
  clear(list);
  let data = res.ok ? res.data : [];

  state.deletedReminderIds = state.deletedReminderIds || [];
  data = data.filter(r => !state.deletedReminderIds.includes(r.id));

  state.updatedReminders = state.updatedReminders || {};
  data = data.map(r => state.updatedReminders[r.id] ? { ...r, ...state.updatedReminders[r.id] } : r);

  state.pendingReminders = state.pendingReminders || [];
  const pending = state.pendingReminders.filter(r => r.vehicleId === state.currentVehicleId);
  const existingSignatures = new Set(data.map(d => `${d.title}_${d.dueDate}_${d.dueMileage}`));
  
  pending.forEach(p => { 
      if (!existingSignatures.has(`${p.title}_${p.dueDate}_${p.dueMileage}`)) data.push(p); 
  });

  if (data.length > 0) {
    data.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        const dateDiff = new Date(a.dueDate) - new Date(b.dueDate);
        if (dateDiff !== 0) return dateDiff;
      } 
      const timeB = b.createdAt?.seconds || Date.now() / 1000;
      const timeA = a.createdAt?.seconds || Date.now() / 1000;
      return timeB - timeA; 
    });

    data.forEach(r => {
      const parts = [];
      const dBefore = r.notifyDaysBefore ?? 30;
      const kBefore = r.notifyKmBefore ?? 1000;

      if (r.dueDate) parts.push(`Data: ${r.dueDate} (${dBefore} dni przed)`);
      if (r.dueMileage) parts.push(`Przebieg: ${r.dueMileage} km (${kBefore} km przed)`);
      
      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [`${r.title} ${r.isPending ? '(Zapisane lokalnie)' : ''}`]),
            el('p', { className: 'reminder-info' }, [parts.join(' | ')])
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

// Edycja
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

// Usuwanie
async function remove(id) {

  if (!navigator.onLine) {
    showNotification("Brak internetu. Nie można usunąć przypomnienia w trybie offline.", "error");
    return;
  }

  showConfirm("Czy na pewno usunąć przypomnienie?", () => {
    state.deletedReminderIds = (state.deletedReminderIds || []).concat(id);
    deleteReminder(id).catch(e => console.error(e));
    showNotification("Usunięto", "info");
    loadReminders();
  });
}

export function initReminderHandlers() {
  const validateReminder = (titleEl, dateEl, mileageEl) => {
    clearFieldErrors(); 
    let isValid = true;
    if (!titleEl.value.trim()) { showFieldError(titleEl, "Tytuł wymagany."); isValid = false; }
    if (!dateEl.value && !mileageEl.value) { showFieldError(dateEl, "Podaj datę lub przebieg."); showFieldError(mileageEl, "Podaj datę lub przebieg."); isValid = false; }
    return isValid;
  };

  document.getElementById('btn-show-add-reminder').onclick = () => {
    clearFieldErrors(); clearInputs('view-add-reminder');
    document.getElementById('rem-days-30').checked = true;
    document.getElementById('rem-km-1000').checked = true;
    showView('view-add-reminder');
  };

  document.getElementById('btn-save-reminder').onclick = async () => {
    const titleIn = document.getElementById('rem-title'), dateIn = document.getElementById('rem-date'), milIn = document.getElementById('rem-mileage');
    if (!validateReminder(titleIn, dateIn, milIn)) return;

    try {
      const finalDays = document.querySelector('input[name="rem-notify-days"]:checked')?.value || 30;
      const finalKm = document.querySelector('input[name="rem-notify-km"]:checked')?.value || 1000;

      const rawData = {
        vehicleId: state.currentVehicleId,
        vehicleName: document.getElementById('detail-title').textContent,
        title: titleIn.value,
        dueDate: dateIn.value || null,
        dueMileage: milIn.value || null,
        notifyDaysBefore: Number(finalDays),
        notifyKmBefore: Number(finalKm),
        isActive: true
      };

      const localData = { ...rawData, id: 'temp-' + Date.now(), isPending: true };
      state.pendingReminders = (state.pendingReminders || []).concat(localData);
      
      clearInputs('view-add-reminder');
      showView('view-vehicle-details');
      loadReminders();
      
      addReminder(validateReminderData(rawData)).then(() => {
          state.pendingReminders = state.pendingReminders.filter(r => r.id !== localData.id);
          loadReminders();
      });
      showNotification(navigator.onLine ? "Zapisano" : "Zapisano lokalnie", navigator.onLine ? "success" : "info");
    } catch (err) { showNotification(err.message, "error"); }
  };

  document.getElementById('btn-update-reminder').onclick = async () => {
    const titleIn = document.getElementById('edit-rem-title'), dateIn = document.getElementById('edit-rem-date'), milIn = document.getElementById('edit-rem-mileage');
    if (!validateReminder(titleIn, dateIn, milIn)) return;

    try {
      const finalDays = document.querySelector('input[name="edit-rem-notify-days"]:checked')?.value || 30;
      const finalKm = document.querySelector('input[name="edit-rem-notify-km"]:checked')?.value || 1000;

      const rawData = {
        title: titleIn.value,
        dueDate: dateIn.value || null,
        dueMileage: milIn.value || null,
        notifyDaysBefore: Number(finalDays),
        notifyKmBefore: Number(finalKm),
      };

      state.updatedReminders = state.updatedReminders || {};
      state.updatedReminders[state.editReminderId] = { ...rawData, id: state.editReminderId, isPending: true };
      
      showView('view-vehicle-details');
      loadReminders();

      updateReminder(state.editReminderId, validateReminderUpdateData(rawData)).then(() => {
          delete state.updatedReminders[state.editReminderId];
          loadReminders();
      });
      showNotification(navigator.onLine ? "Zaktualizowano" : "Zapisano lokalnie", navigator.onLine ? "success" : "info");
    } catch (err) { showNotification(err.message, "error"); }
  };
}
