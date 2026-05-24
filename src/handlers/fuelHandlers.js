import { getFuelRecordsByVehicle, addFuelRecord, deleteFuelRecord, updateFuelRecord } from '../services/fuelRecordService.js';
import { el, clear } from '../domHelpers.js';
import { state } from '../state.js';
import { showView, clearInputs, confirmAction } from '../uiUtils.js';
import { validateFuelRecordData } from '../validators.js';
import {
  showFormError,
  clearFormErrors
} from '../errors.js';

import { storage, auth } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const ADD_FUEL_FIELDS = {
  date: 'fuel-date',
  mileage: 'fuel-mileage',
  liters: 'fuel-liters',
  cost: 'fuel-cost'
};

const EDIT_FUEL_FIELDS = {
  date: 'edit-fuel-date',
  mileage: 'edit-fuel-mileage',
  liters: 'edit-fuel-liters',
  cost: 'edit-fuel-cost'
};

async function uploadFuelAttachment(file) {
  if (!file) return null;

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Musisz być zalogowany, aby dodać załącznik.');
  }

  const storageRef = ref(
    storage,
    `fuel_receipts/${user.uid}/${Date.now()}_${file.name}`
  );

  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
}

export async function loadFuelRecords() {
  const list = document.getElementById('records-list');
  if (!list) return;

  clear(list);

  const res = await getFuelRecordsByVehicle(state.currentVehicleId);

  if (res.ok && res.data.length > 0) {
    res.data.forEach(r => {
      const li = el('li', {}, [
        el('div', { className: 'record-row' }, [
          el('div', {}, [
            el('h3', {}, [`Data: ${r.date}`]),
            el('p', {}, [`${r.cost} PLN | ${r.liters} L`]),
            r.consumption
              ? el('p', { className: 'consumption-text' }, [`Spalanie: ${r.consumption} l/100km`])
              : '',
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
    list.appendChild(el('p', { className: 'empty-state' }, ['Brak wpisów o tankowaniu.']));
  }
}

function startEdit(r) {
  state.editFuelId = r.id;

  clearFormErrors('view-edit-fuel');

  document.getElementById('edit-fuel-date').value = r.date || '';
  document.getElementById('edit-fuel-mileage').value = r.mileage || '';
  document.getElementById('edit-fuel-liters').value = r.liters || '';
  document.getElementById('edit-fuel-cost').value = r.cost || '';

  const fileInput = document.getElementById('edit-fuel-file');
  if (fileInput) fileInput.value = '';

  showView('view-edit-fuel');
}

async function remove(id) {
  const confirmed = await confirmAction({
    title: 'Usuwanie tankowania',
    message: 'Czy na pewno chcesz usunąć ten wpis o tankowaniu?',
    confirmText: 'Usuń',
    cancelText: 'Anuluj',
    danger: true
  });

  if (confirmed) {
    const res = await deleteFuelRecord(id);

    if (res.ok) {
      loadFuelRecords();
    } else {
      showFormError('view-vehicle-details', res.error);
    }
  }
}

export function initFuelHandlers() {
  const showAddFuelBtn = document.getElementById('btn-show-add-fuel');

  if (showAddFuelBtn) {
    showAddFuelBtn.onclick = () => {
      clearInputs('view-add-fuel');

      document.getElementById('fuel-date').value = new Date().toISOString().split('T')[0];

      const fileInput = document.getElementById('fuel-file');
      if (fileInput) fileInput.value = '';

      showView('view-add-fuel');
    };
  }

  const saveFuelBtn = document.getElementById('btn-save-fuel');

  if (saveFuelBtn) {
    saveFuelBtn.onclick = async () => {
      try {
        clearFormErrors('view-add-fuel');

        saveFuelBtn.disabled = true;
        saveFuelBtn.innerText = 'Sprawdzanie danych...';

        const fileInput = document.getElementById('fuel-file');
        const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

        const rawData = {
          vehicleId: state.currentVehicleId,
          date: document.getElementById('fuel-date').value,
          mileage: document.getElementById('fuel-mileage').value,
          liters: document.getElementById('fuel-liters').value,
          cost: document.getElementById('fuel-cost').value,
          attachmentUrl: null
        };

        const validatedData = validateFuelRecordData(rawData);

        let attachmentUrl = null;

        if (file) {
          saveFuelBtn.innerText = 'Wysyłanie zdjęcia...';
          attachmentUrl = await uploadFuelAttachment(file);
        }

        saveFuelBtn.innerText = 'Zapisywanie...';

        const res = await addFuelRecord({
          ...validatedData,
          attachmentUrl
        });

        if (res.ok) {
          clearInputs('view-add-fuel');
          if (fileInput) fileInput.value = '';
          showView('view-vehicle-details');
          loadFuelRecords();
        } else {
          showFormError('view-add-fuel', res.error, ADD_FUEL_FIELDS);
        }
      } catch (error) {
        showFormError('view-add-fuel', error, ADD_FUEL_FIELDS);
      } finally {
        saveFuelBtn.innerText = 'Zapisz tankowanie';
        saveFuelBtn.disabled = false;
      }
    };
  }

  const updateFuelBtn = document.getElementById('btn-update-fuel');

  if (updateFuelBtn) {
    updateFuelBtn.onclick = async () => {
      try {
        clearFormErrors('view-edit-fuel');

        updateFuelBtn.disabled = true;
        updateFuelBtn.innerText = 'Sprawdzanie danych...';

        const fileInput = document.getElementById('edit-fuel-file');
        const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

        const rawData = {
          vehicleId: state.currentVehicleId,
          date: document.getElementById('edit-fuel-date').value,
          mileage: document.getElementById('edit-fuel-mileage').value,
          liters: document.getElementById('edit-fuel-liters').value,
          cost: document.getElementById('edit-fuel-cost').value,
          attachmentUrl: undefined
        };

        const validatedData = validateFuelRecordData(rawData);

        let attachmentUrl = undefined;

        if (file) {
          updateFuelBtn.innerText = 'Wysyłanie zdjęcia...';
          attachmentUrl = await uploadFuelAttachment(file);
        }

        updateFuelBtn.innerText = 'Zapisywanie...';

        const payload = {
          ...validatedData
        };

        if (attachmentUrl) {
          payload.attachmentUrl = attachmentUrl;
        } else {
          delete payload.attachmentUrl;
        }

        const res = await updateFuelRecord(state.editFuelId, payload);

        if (res.ok) {
          clearInputs('view-edit-fuel');
          if (fileInput) fileInput.value = '';
          showView('view-vehicle-details');
          loadFuelRecords();
        } else {
          showFormError('view-edit-fuel', res.error, EDIT_FUEL_FIELDS);
        }
      } catch (error) {
        showFormError('view-edit-fuel', error, EDIT_FUEL_FIELDS);
      } finally {
        updateFuelBtn.innerText = 'Zapisz zmiany';
        updateFuelBtn.disabled = false;
      }
    };
  }
}