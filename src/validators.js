import { AppError } from "./errors.js";

// Sprawdzanie poprawności adresu e-mail
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(String(email).toLowerCase())) {
    throw new AppError("Podaj poprawny adres e-mail", "VALIDATION_ERROR");
  }
  return email;
}

// Weryfikacja długości hasła
export function validatePassword(password) {
  if (!password || password.length < 6) {
    throw new AppError("Hasło musi mieć co najmniej 6 znaków", "VALIDATION_ERROR");
  }
  return password;
}

// Sprawdzanie formularza pojazdu
export function validateVehicleData(data) {
  if (!data.brand?.trim()) throw new AppError("Marka jest wymagana", "VALIDATION_ERROR");
  if (!data.model?.trim()) throw new AppError("Model jest wymagany", "VALIDATION_ERROR");
  
  const year = Number(data.year);
  const mileage = Number(data.currentMileage);

  if (isNaN(year) || year < 1900 || year > 2100) throw new AppError("Podaj poprawny rocznik", "VALIDATION_ERROR");
  if (isNaN(mileage) || mileage < 0) throw new AppError("Podaj poprawny przebieg", "VALIDATION_ERROR");

  return { ...data, year, currentMileage: mileage };
}

// Weryfikacja danych tankowania
export function validateFuelRecordData(data) {
  if (!data.date) throw new AppError("Data jest wymagana", "VALIDATION_ERROR");
  
  const mileage = Number(data.mileage);
  const liters = Number(data.liters);
  const cost = Number(data.cost || 0);

  if (isNaN(mileage) || mileage <= 0) throw new AppError("Przebieg musi być liczbą dodatnią", "VALIDATION_ERROR");
  if (isNaN(liters) || liters <= 0) throw new AppError("Ilość litrów musi być liczbą dodatnią", "VALIDATION_ERROR");
  if (isNaN(cost) || cost < 0) throw new AppError("Koszt musi być poprawną kwotą (nie mniejszą od zera)", "VALIDATION_ERROR");
  
  return { 
    vehicleId: data.vehicleId,
    date: data.date,
    mileage: mileage, 
    liters: liters, 
    cost: cost,
    attachmentUrl: data.attachmentUrl || null
  };
}

// Weryfikacja wpisu serwisowego
export function validateServiceRecordData(data) {
  if (!data.description?.trim()) throw new AppError("Opis naprawy jest wymagany", "VALIDATION_ERROR");
  if (!data.date) throw new AppError("Data jest wymagana", "VALIDATION_ERROR");
  
  const mileage = Number(data.mileage || 0);
  const cost = Number(data.cost || 0);

  if (isNaN(mileage) || mileage < 0) throw new AppError("Przebieg musi być poprawną liczbą (nie mniejszą od zera)", "VALIDATION_ERROR");
  if (isNaN(cost) || cost < 0) throw new AppError("Koszt naprawy musi być poprawną kwotą (nie mniejszą od zera)", "VALIDATION_ERROR");
  
  return { 
    vehicleId: data.vehicleId,
    date: data.date,
    description: data.description,
    mileage: mileage, 
    cost: cost,
    attachmentUrl: data.attachmentUrl || null
  };
}

// Sprawdzanie poprawności nowego przypomnienia
export function validateReminderData(data) {
  if (!data.title?.trim()) throw new AppError("Tytuł przypomnienia jest wymagany", "VALIDATION_ERROR");

  let parsedMileage = null;

  if (data.dueMileage) {
    parsedMileage = Number(data.dueMileage);
    if (isNaN(parsedMileage) || parsedMileage < 0) {
      throw new AppError("Przebieg w przypomnieniu musi być poprawną liczbą dodatnią", "VALIDATION_ERROR");
    }
  }

  if (!data.dueDate && parsedMileage === null) {
    throw new AppError("Podaj datę lub poprawny przebieg przypomnienia", "VALIDATION_ERROR");
  }

  return {
    ...data,
    dueMileage: parsedMileage
  };
}

// Weryfikacja wprowadzanych zmian podczas edycji przypomnienia
export function validateReminderUpdateData(data) {
  const validatedData = { ...data };

  if (validatedData.title !== undefined && !validatedData.title.trim()) {
    throw new AppError("Tytuł przypomnienia nie może być pusty", "VALIDATION_ERROR");
  }

  if (validatedData.dueMileage !== undefined && validatedData.dueMileage !== null && validatedData.dueMileage !== "") {
    const parsedMileage = Number(validatedData.dueMileage);
    if (isNaN(parsedMileage) || parsedMileage < 0) {
      throw new AppError("Przebieg w przypomnieniu musi być poprawną liczbą dodatnią", "VALIDATION_ERROR");
    }
    validatedData.dueMileage = parsedMileage;
  } else if (validatedData.dueMileage === "") {    
    validatedData.dueMileage = null;
  }

  return validatedData;
}