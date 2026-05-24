import { getServiceRecordsByVehicle, addServiceRecord, deleteServiceRecord, updateServiceRecord } from '../services/serviceRecordService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs, confirmAction } from '../uiUtils.js';
import { validateServiceRecordData } from '../validators.js';
import {
  showFormError,
  clearFormErrors
} from '../errors.js';

import { storage, auth } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const ADD_SERVICE_FIELDS = {
  date: 'srv-date',
  description: 'srv-desc',
  mileage: 'srv-mileage',
  cost: 'srv-cost'
};

const EDIT_SERVICE_FIELDS = {
  date: 'edit-srv-date',
  description: 'edit-srv-desc',
  mileage: 'edit-srv-mileage',
  cost: 'edit-srv-cost'
};

async function uploadServiceAttachment(file) {
  if (!file) return null;

  const user = auth.currentUser;

  if (!user) {
    throw new Error('Musisz być zalogowany, aby dodać załącznik.');
  }

  const storageRef = ref(
    storage,
    `service_receipts/${user.uid}/${Date.now()}_${file.name}`
  );

  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
}

// Pobieranie i wyświetlanie historii napraw/serwisów dla wybranego pojazdu
export async function loadServiceRecords() {
  const list = document.getElementById('records-list');
  if (!list) return;

  clear(list);

  const res = await getServiceRecordsByVehicle(state.currentVehicleId);

  if (res.ok && res.data.length > 0) {
    res.data.forEach(r => {
      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [r.description]),
            el('p', {}, [`${r.cost} PLN | Data: ${r.date}`]),
            el('p', { className: 'record-meta' }, [`Przebieg: ${r.mileage} km`]),
            r.attachmentUrl
              ? el('a', {
                  href: r.attachmentUrl,
                  target: '_blank',
                  className: 'attachment-link'
                }, ['Zobacz załącznik'])
              : ''
          ]),
          el('div', { className: 'actions-vertical' }, [
            el('button', {
              className: 'small secondary',
              onclick: (e) => {
                e.stopPropagation();
                startEdit(r);
              }
            }, ['Edytuj']),
            el('button', {
              className: 'small secondary danger-text',
              onclick: (e) => {
                e.stopPropagation();
                remove(r.id);
              }
            }, ['Usuń'])
          ])
        ])
      ]);

      list.appendChild(li);
    });
  } else {
    list.appendChild(el('p', { className: 'empty-state' }, ['Brak wpisów serwisowych.']));
  }
}

// Wypełnianie formularza edycji danymi z wybranego wpisu serwisowego
function startEdit(r) {
  state.editServiceId = r.id;

  clearFormErrors('view-edit-service');

  document.getElementById('edit-srv-date').value = r.date || '';
  document.getElementById('edit-srv-desc').value = r.description || '';
  document.getElementById('edit-srv-mileage').value = r.mileage || '';
  document.getElementById('edit-srv-cost').value = r.cost || '';

  const fileInput = document.getElementById('edit-srv-file');
  if (fileInput) fileInput.value = '';

  showView('view-edit-service');
}

// Usuwanie wpisu z historii serwisowej
async function remove(id) {
  const confirmed = await confirmAction({
    title: 'Usuwanie wpisu serwisowego',
    message: 'Czy na pewno chcesz usunąć ten wpis serwisowy?',
    confirmText: 'Usuń',
    cancelText: 'Anuluj',
    danger: true
  });

  if (confirmed) {
    const res = await deleteServiceRecord(id);

    if (res.ok) {
      loadServiceRecords();
    } else {
      showFormError('view-vehicle-details', res.error);
    }
  }
}

export function initServiceHandlers() {
  const addBtn = document.getElementById('btn-show-add-service');

  if (addBtn) {
    addBtn.onclick = () => {
      clearInputs('view-add-service');

      document.getElementById('srv-date').value = new Date().toISOString().split('T')[0];

      const fileInput = document.getElementById('srv-file');
      if (fileInput) fileInput.value = '';

      showView('view-add-service');
    };
  }

  const saveBtn = document.getElementById('btn-save-service');

  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        clearFormErrors('view-add-service');

        saveBtn.disabled = true;
        saveBtn.innerText = 'Sprawdzanie danych...';

        const fileInput = document.getElementById('srv-file');
        const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

        const rawData = {
          vehicleId: state.currentVehicleId,
          date: document.getElementById('srv-date').value,
          description: document.getElementById('srv-desc').value,
          mileage: document.getElementById('srv-mileage').value,
          cost: document.getElementById('srv-cost').value,
          attachmentUrl: null
        };

        const validatedData = validateServiceRecordData(rawData);

        let attachmentUrl = null;

        if (file) {
          saveBtn.innerText = 'Wysyłanie pliku...';
          attachmentUrl = await uploadServiceAttachment(file);
        }

        saveBtn.innerText = 'Zapisywanie...';

        const res = await addServiceRecord({
          ...validatedData,
          attachmentUrl
        });

        if (res.ok) {
          clearInputs('view-add-service');
          if (fileInput) fileInput.value = '';
          showView('view-vehicle-details');
          loadServiceRecords();
        } else {
          showFormError('view-add-service', res.error, ADD_SERVICE_FIELDS);
        }
      } catch (error) {
        showFormError('view-add-service', error, ADD_SERVICE_FIELDS);
      } finally {
        saveBtn.innerText = 'Zapisz wpis serwisowy';
        saveBtn.disabled = false;
      }
    };
  }

  const updateBtn = document.getElementById('btn-update-service');

  if (updateBtn) {
    updateBtn.onclick = async () => {
      try {
        clearFormErrors('view-edit-service');

        updateBtn.disabled = true;
        updateBtn.innerText = 'Sprawdzanie danych...';

        const fileInput = document.getElementById('edit-srv-file');
        const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

        const rawData = {
          vehicleId: state.currentVehicleId,
          date: document.getElementById('edit-srv-date').value,
          description: document.getElementById('edit-srv-desc').value,
          mileage: document.getElementById('edit-srv-mileage').value,
          cost: document.getElementById('edit-srv-cost').value,
          attachmentUrl: undefined
        };

        const validatedData = validateServiceRecordData(rawData);

        let attachmentUrl = undefined;

        if (file) {
          updateBtn.innerText = 'Wysyłanie pliku...';
          attachmentUrl = await uploadServiceAttachment(file);
        }

        updateBtn.innerText = 'Zapisywanie...';

        const payload = {
          ...validatedData
        };

        if (attachmentUrl) {
          payload.attachmentUrl = attachmentUrl;
        } else {
          delete payload.attachmentUrl;
        }

        const res = await updateServiceRecord(state.editServiceId, payload);

        if (res.ok) {
          clearInputs('view-edit-service');
          if (fileInput) fileInput.value = '';
          showView('view-vehicle-details');
          loadServiceRecords();
        } else {
          showFormError('view-edit-service', res.error, EDIT_SERVICE_FIELDS);
        }
      } catch (error) {
        showFormError('view-edit-service', error, EDIT_SERVICE_FIELDS);
      } finally {
        updateBtn.innerText = 'Zapisz zmiany';
        updateBtn.disabled = false;
      }
    };
  }
}