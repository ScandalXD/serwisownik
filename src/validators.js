import { AppError } from './errors.js';

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function parseNumber(value, field, message) {
  if (isEmpty(value)) {
    throw new AppError(message, 'VALIDATION_ERROR', field);
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new AppError(message, 'VALIDATION_ERROR', field);
  }

  return parsed;
}

// Sprawdzanie poprawności adresu e-mail
export function validateEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!re.test(normalizedEmail)) {
    throw new AppError('Podaj poprawny adres e-mail', 'VALIDATION_ERROR', 'email');
  }

  return normalizedEmail;
}

// Weryfikacja długości hasła
export function validatePassword(password) {
  if (!password || String(password).length < 6) {
    throw new AppError('Hasło musi mieć co najmniej 6 znaków', 'VALIDATION_ERROR', 'password');
  }

  return password;
}

export function validatePasswordConfirmation(password, passwordConfirm) {
  validatePassword(password);

  if (!passwordConfirm || String(passwordConfirm).length < 6) {
    throw new AppError(
      'Potwierdzenie hasła musi mieć co najmniej 6 znaków',
      'VALIDATION_ERROR',
      'passwordConfirm'
    );
  }

  if (password !== passwordConfirm) {
    throw new AppError(
      'Hasła nie są takie same',
      'VALIDATION_ERROR',
      'passwordConfirm'
    );
  }

  return true;
}

// Sprawdzanie formularza pojazdu
export function validateVehicleData(data) {
  const brand = String(data.brand || '').trim();
  const model = String(data.model || '').trim();

  if (!brand) {
    throw new AppError('Marka jest wymagana', 'VALIDATION_ERROR', 'brand');
  }

  if (!model) {
    throw new AppError('Model jest wymagany', 'VALIDATION_ERROR', 'model');
  }

  const year = parseNumber(data.year, 'year', 'Podaj poprawny rocznik');
  const mileage = parseNumber(data.currentMileage, 'currentMileage', 'Podaj poprawny przebieg');

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 1;

  if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
    throw new AppError(`Rocznik musi być liczbą całkowitą od 1900 do ${maxYear}`, 'VALIDATION_ERROR', 'year');
  }

  if (mileage < 0) {
    throw new AppError('Przebieg nie może być mniejszy od zera', 'VALIDATION_ERROR', 'currentMileage');
  }

  return {
    brand,
    model,
    year,
    currentMileage: mileage
  };
}

export function validateVehicleEditData(data) {
  const brand = String(data.brand || '').trim();
  const model = String(data.model || '').trim();

  if (!brand) {
    throw new AppError('Marka jest wymagana', 'VALIDATION_ERROR', 'brand');
  }

  if (!model) {
    throw new AppError('Model jest wymagany', 'VALIDATION_ERROR', 'model');
  }

  const year = parseNumber(data.year, 'year', 'Podaj poprawny rocznik');

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 1;

  if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
    throw new AppError(`Rocznik musi być liczbą całkowitą od 1900 do ${maxYear}`, 'VALIDATION_ERROR', 'year');
  }

  return {
    brand,
    model,
    year
  };
}

// Weryfikacja danych tankowania
export function validateFuelRecordData(data) {
  if (!data.vehicleId) {
    throw new AppError('Najpierw wybierz pojazd', 'VALIDATION_ERROR');
  }

  if (!data.date) {
    throw new AppError('Data jest wymagana', 'VALIDATION_ERROR', 'date');
  }

  const mileage = parseNumber(data.mileage, 'mileage', 'Przebieg musi być liczbą dodatnią');
  const liters = parseNumber(data.liters, 'liters', 'Ilość litrów musi być liczbą dodatnią');
  const cost = parseNumber(data.cost, 'cost', 'Koszt całkowity jest wymagany');

  if (mileage <= 0) {
    throw new AppError('Przebieg musi być większy od zera', 'VALIDATION_ERROR', 'mileage');
  }

  if (mileage > 2000000) {
    throw new AppError('Przebieg wygląda na zbyt duży. Sprawdź wpisaną wartość', 'VALIDATION_ERROR', 'mileage');
  }

  if (liters <= 0) {
    throw new AppError('Ilość litrów musi być większa od zera', 'VALIDATION_ERROR', 'liters');
  }

  if (liters > 500) {
    throw new AppError('Ilość litrów wygląda na zbyt dużą. Sprawdź wpisaną wartość', 'VALIDATION_ERROR', 'liters');
  }

  if (cost <= 0) {
    throw new AppError('Koszt całkowity musi być większy od zera', 'VALIDATION_ERROR', 'cost');
  }

  return {
    vehicleId: data.vehicleId,
    date: data.date,
    mileage,
    liters,
    cost,
    attachmentUrl: data.attachmentUrl || null
  };
}

// Weryfikacja wpisu serwisowego
export function validateServiceRecordData(data) {
  if (!data.vehicleId) {
    throw new AppError('Najpierw wybierz pojazd', 'VALIDATION_ERROR');
  }

  if (!data.date) {
    throw new AppError('Data jest wymagana', 'VALIDATION_ERROR', 'date');
  }

  const description = String(data.description || '').trim();

  if (!description) {
    throw new AppError('Opis naprawy jest wymagany', 'VALIDATION_ERROR', 'description');
  }

  const mileage = parseNumber(
    data.mileage,
    'mileage',
    'Przebieg jest wymagany'
  );

  const cost = parseNumber(
    data.cost,
    'cost',
    'Koszt całkowity jest wymagany'
  );

  if (mileage <= 0) {
    throw new AppError(
      'Przebieg musi być większy od zera',
      'VALIDATION_ERROR',
      'mileage'
    );
  }

  if (mileage > 2000000) {
    throw new AppError(
      'Przebieg wygląda na zbyt duży. Sprawdź wpisaną wartość',
      'VALIDATION_ERROR',
      'mileage'
    );
  }

  if (cost <= 0) {
    throw new AppError(
      'Koszt całkowity musi być większy od zera',
      'VALIDATION_ERROR',
      'cost'
    );
  }

  return {
    vehicleId: data.vehicleId,
    date: data.date,
    description,
    mileage,
    cost,
    attachmentUrl: data.attachmentUrl || null
  };
}

// Sprawdzanie poprawności nowego przypomnienia
export function validateReminderData(data) {
  const title = String(data.title || '').trim();

  if (!title) {
    throw new AppError('Tytuł przypomnienia jest wymagany', 'VALIDATION_ERROR', 'title');
  }

  let parsedMileage = null;

  if (!isEmpty(data.dueMileage)) {
    parsedMileage = Number(data.dueMileage);
    if (Number.isNaN(parsedMileage) || parsedMileage < 0) {
      throw new AppError('Przebieg w przypomnieniu musi być poprawną liczbą dodatnią', 'VALIDATION_ERROR', 'dueMileage');
    }
  }

  if (!data.dueDate && parsedMileage === null) {
    throw new AppError('Podaj datę albo przebieg przypomnienia', 'VALIDATION_ERROR', 'dueDate');
  }

  return {
    ...data,
    title,
    dueMileage: parsedMileage
  };
}

// Weryfikacja wprowadzanych zmian podczas edycji przypomnienia
export function validateReminderUpdateData(data) {
  const validatedData = { ...data };

  if (validatedData.title !== undefined) {
    const title = String(validatedData.title || '').trim();
    if (!title) {
      throw new AppError('Tytuł przypomnienia nie może być pusty', 'VALIDATION_ERROR', 'title');
    }
    validatedData.title = title;
  }

  if (validatedData.dueMileage !== undefined && validatedData.dueMileage !== null && validatedData.dueMileage !== '') {
    const parsedMileage = Number(validatedData.dueMileage);
    if (Number.isNaN(parsedMileage) || parsedMileage < 0) {
      throw new AppError('Przebieg w przypomnieniu musi być poprawną liczbą dodatnią', 'VALIDATION_ERROR', 'dueMileage');
    }
    validatedData.dueMileage = parsedMileage;
  } else if (validatedData.dueMileage === '') {
    validatedData.dueMileage = null;
  }

  if (!validatedData.dueDate && (validatedData.dueMileage === null || validatedData.dueMileage === undefined)) {
    throw new AppError('Podaj datę albo przebieg przypomnienia', 'VALIDATION_ERROR', 'dueDate');
  }

  return validatedData;
}