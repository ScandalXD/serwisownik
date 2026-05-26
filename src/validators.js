import { AppError } from "./errors.js";

// Sprawdzanie poprawności adresu e-mail
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(String(email).toLowerCase())) {
    throw new AppError("Podaj poprawny adres e-mail", "VALIDATION_ERROR");
  }
  return email;
}

// Weryfikacja poprawności hasła
export function validatePassword(password) {
  if (!password) {
    throw new AppError("Hasło jest wymagane", "VALIDATION_ERROR");
  }
  
  if (password.length < 8) throw new AppError("Hasło musi mieć minimum 8 znaków", "VALIDATION_ERROR");
  if (!/[A-Z]/.test(password)) throw new AppError("Hasło musi zawierać wielką literę", "VALIDATION_ERROR");
  if (!/[0-9]/.test(password)) throw new AppError("Hasło musi zawierać cyfrę", "VALIDATION_ERROR");
  if (!/[^A-Za-z0-9]/.test(password)) throw new AppError("Hasło musi zawierać znak specjalny", "VALIDATION_ERROR");
  
  return password;
}

// Sprawdzanie formularza pojazdu
export function validateVehicleData(data) {
  if (!data.brand?.trim()) throw new AppError("Marka jest wymagana", "VALIDATION_ERROR");
  if (!data.model?.trim()) throw new AppError("Model jest wymagany", "VALIDATION_ERROR");

  if (data.year === "" || data.currentMileage === "") {
    throw new AppError("Wszystkie pola liczbowe (rok, przebieg) muszą być wypełnione", "VALIDATION_ERROR");
  }
  
  const year = Number(data.year);
  const mileage = Number(data.currentMileage);

  if (isNaN(year) || year < 1900 || year > 2100) throw new AppError("Podaj poprawny rocznik", "VALIDATION_ERROR");
  if (isNaN(mileage) || mileage < 0) throw new AppError("Podaj poprawny przebieg", "VALIDATION_ERROR");

  return { ...data, year, currentMileage: mileage };
}

// Weryfikacja danych tankowania
export function validateFuelRecordData(data) {
  if (!data.date) throw new AppError("Data jest wymagana", "VALIDATION_ERROR");
  
  if (data.mileage === "" || data.liters === "" || data.cost === "") {
    throw new AppError("Wszystkie pola (przebieg, litry, koszt) muszą być wypełnione", "VALIDATION_ERROR");
  }

  const mileage = Number(data.mileage);
  const liters = Number(data.liters);
  const cost = Number(data.cost); 

  if (isNaN(mileage) || mileage <= 0) throw new AppError("Przebieg musi być liczbą dodatnią", "VALIDATION_ERROR");
  if (isNaN(liters) || liters <= 0) throw new AppError("Ilość litrów musi być liczbą dodatnią", "VALIDATION_ERROR");
  if (isNaN(cost) || cost < 0) throw new AppError("Koszt musi być poprawną kwotą (nie mniejszą od zera)", "VALIDATION_ERROR");
  
  let validAttachmentUrl = undefined;
  if (data.attachmentUrl !== undefined) {
    validAttachmentUrl = data.attachmentUrl;
  }
  
  return { 
    vehicleId: data.vehicleId,
    date: data.date,
    mileage: mileage, 
    liters: liters, 
    cost: cost,
    attachmentUrl: validAttachmentUrl
  };
}

// Weryfikacja wpisu serwisowego
export function validateServiceRecordData(data) {
  if (!data.description?.trim()) throw new AppError("Opis naprawy jest wymagany", "VALIDATION_ERROR");
  if (!data.date) throw new AppError("Data jest wymagana", "VALIDATION_ERROR");
  
  if (data.mileage === "" || data.cost === "") {
    throw new AppError("Przebieg i koszt muszą być wypełnione liczbami", "VALIDATION_ERROR");
  }

  const mileage = Number(data.mileage);
  const cost = Number(data.cost); 

  if (isNaN(mileage) || mileage < 0) throw new AppError("Przebieg musi być poprawną liczbą (nie mniejszą od zera)", "VALIDATION_ERROR");
  if (isNaN(cost) || cost < 0) throw new AppError("Koszt naprawy musi być poprawną kwotą (nie mniejszą od zera)", "VALIDATION_ERROR");
  
  let validAttachmentUrl = undefined;
  if (data.attachmentUrl !== undefined) {
    validAttachmentUrl = data.attachmentUrl;
  }
  
  return { 
    vehicleId: data.vehicleId,
    date: data.date,
    description: data.description,
    mileage: mileage, 
    cost: cost,
    attachmentUrl: validAttachmentUrl
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
    
    if (data.currentVehicleMileage !== undefined && parsedMileage <= data.currentVehicleMileage) {
      throw new AppError(`Przebieg przypomnienia nie może być mniejszy lub równy aktualnemu przebiegowi auta (${data.currentVehicleMileage} km)!`, "VALIDATION_ERROR");
    }
  }

  if (data.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const reminderDate = new Date(data.dueDate);
    if (reminderDate < today) {
      throw new AppError("Data przypomnienia nie może być z przeszłości!", "VALIDATION_ERROR");
    }
  }

  if (!data.dueDate && parsedMileage === null) {
    throw new AppError("Podaj datę lub poprawny przebieg przypomnienia", "VALIDATION_ERROR");
  }

  const notifyDaysBefore = data.notifyDaysBefore !== undefined ? Number(data.notifyDaysBefore) : 30;
  const notifyKmBefore = data.notifyKmBefore !== undefined ? Number(data.notifyKmBefore) : 1000;

  return {
    ...data,
    dueMileage: parsedMileage,
    notifyDaysBefore, 
    notifyKmBefore     
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
    
    if (validatedData.currentVehicleMileage !== undefined && parsedMileage <= validatedData.currentVehicleMileage) {
      throw new AppError(`Przebieg przypomnienia nie może być mniejszy lub równy aktualnemu przebiegowi auta (${validatedData.currentVehicleMileage} km)!`, "VALIDATION_ERROR");
    }
    
    validatedData.dueMileage = parsedMileage;
  } else if (validatedData.dueMileage === "") {    
    validatedData.dueMileage = null;
  }

  if (validatedData.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const reminderDate = new Date(validatedData.dueDate);
    if (reminderDate < today) {
      throw new AppError("Data przypomnienia nie może być z przeszłości", "VALIDATION_ERROR");
    }
  } else if (validatedData.dueDate === "") {
    validatedData.dueDate = null;
  }

  if (data.notifyDaysBefore !== undefined) {
    validatedData.notifyDaysBefore = Number(data.notifyDaysBefore);
  }
  if (data.notifyKmBefore !== undefined) {
    validatedData.notifyKmBefore = Number(data.notifyKmBefore);
  }

  return validatedData;
}
