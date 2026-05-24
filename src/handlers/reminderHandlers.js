import { getRemindersByVehicle, addReminder, deleteReminder, updateReminder } from '../services/reminderService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs, confirmAction } from '../uiUtils.js';
import { validateReminderData, validateReminderUpdateData } from '../validators.js';
import {
  showFormError,
  clearFormErrors
} from '../errors.js';

const ADD_REMINDER_FIELDS = {
  title: 'rem-title',
  dueDate: 'rem-date',
  dueMileage: 'rem-mileage'
};

const EDIT_REMINDER_FIELDS = {
  title: 'edit-rem-title',
  dueDate: 'edit-rem-date',
  dueMileage: 'edit-rem-mileage'
};

// Pobieranie i wyświetlanie listy przypomnień dla wybranego pojazdu
export async function loadReminders() {
  const list = document.getElementById('records-list');
  if (!list) return;

  clear(list);

  const res = await getRemindersByVehicle(state.currentVehicleId);

  if (res.ok && res.data.length > 0) {
    res.data.forEach(r => {
      const info =
        (r.dueDate ? `Data: ${r.dueDate} ` : '') +
        (r.dueMileage ? `| Przebieg: ${r.dueMileage} km` : '');

      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [r.title]),
            el('p', {}, [info])
          ]),
          el('div', { className: 'actions-vertical' }, [
            el('button', {
              className: 'small secondary',
              onclick: () => startEdit(r)
            }, ['Edytuj']),
            el('button', {
              className: 'small secondary danger-text',
              onclick: () => remove(r.id)
            }, ['Usuń'])
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

  clearFormErrors('view-edit-reminder');

  document.getElementById('edit-rem-title').value = r.title || '';
  document.getElementById('edit-rem-date').value = r.dueDate || '';
  document.getElementById('edit-rem-mileage').value = r.dueMileage || '';

  showView('view-edit-reminder');
}

// Usuwanie przypomnienia
async function remove(id) {
  const confirmed = await confirmAction({
    title: 'Usuwanie przypomnienia',
    message: 'Czy na pewno chcesz usunąć to przypomnienie?',
    confirmText: 'Usuń',
    cancelText: 'Anuluj',
    danger: true
  });

  if (confirmed) {
    const res = await deleteReminder(id);

    if (res.ok) {
      loadReminders();
    } else {
      showFormError('view-vehicle-details', res.error);
    }
  }
}

export function initReminderHandlers() {
  const addBtn = document.getElementById('btn-show-add-reminder');

  if (addBtn) {
    addBtn.onclick = () => {
      clearInputs('view-add-reminder');
      showView('view-add-reminder');
    };
  }

  const saveBtn = document.getElementById('btn-save-reminder');

  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        clearFormErrors('view-add-reminder');

        saveBtn.disabled = true;
        saveBtn.innerText = 'Zapisywanie...';

        const vehicleName = document.getElementById('detail-title').textContent;

        const rawData = {
          vehicleId: state.currentVehicleId,
          vehicleName: vehicleName,
          title: document.getElementById('rem-title').value,
          dueDate: document.getElementById('rem-date').value || null,
          dueMileage: document.getElementById('rem-mileage').value || null,
          currentVehicleMileage: state.currentVehicleMileage || 0,
          isActive: true
        };

        const validatedData = validateReminderData(rawData);
        const res = await addReminder(validatedData);

        if (res.ok) {
          clearInputs('view-add-reminder');
          showView('view-vehicle-details');
          loadReminders();
        } else {
          showFormError('view-add-reminder', res.error, ADD_REMINDER_FIELDS);
        }
      } catch (error) {
        showFormError('view-add-reminder', error, ADD_REMINDER_FIELDS);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Zapisz przypomnienie';
      }
    };
  }

  const updateBtn = document.getElementById('btn-update-reminder');

  if (updateBtn) {
    updateBtn.onclick = async () => {
      try {
        clearFormErrors('view-edit-reminder');

        updateBtn.disabled = true;
        updateBtn.innerText = 'Zapisywanie...';

        const rawData = {
          title: document.getElementById('edit-rem-title').value,
          dueDate: document.getElementById('edit-rem-date').value || null,
          dueMileage: document.getElementById('edit-rem-mileage').value || null,
          currentVehicleMileage: state.currentVehicleMileage || 0
        };

        const validatedData = validateReminderUpdateData(rawData);
        const res = await updateReminder(state.editReminderId, validatedData);

        if (res.ok) {
          clearInputs('view-edit-reminder');
          showView('view-vehicle-details');
          loadReminders();
        } else {
          showFormError('view-edit-reminder', res.error, EDIT_REMINDER_FIELDS);
        }
      } catch (error) {
        showFormError('view-edit-reminder', error, EDIT_REMINDER_FIELDS);
      } finally {
        updateBtn.disabled = false;
        updateBtn.innerText = 'Zapisz zmiany';
      }
    };
  }
}