import { auth, db } from "../firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { AppError } from "../errors.js";
import { validateFuelRecordData } from "../validators.js";

function requireAuth() {
  const user = auth.currentUser;

  if (!user) {
    throw new AppError("Musisz być zalogowany, aby wykonać tę operację.", "AUTH_REQUIRED");
  }

  return user;
}

function calculateConsumption(previousMileage, currentMileage, liters) {
  const distance = Number(currentMileage) - Number(previousMileage);

  if (distance <= 0) {
    return null;
  }

  const consumption = (Number(liters) / distance) * 100;
  return Number(consumption.toFixed(2));
}

async function getUserVehicle(vehicleId, userId) {
  if (!vehicleId) {
    throw new AppError("Najpierw wybierz pojazd", "VALIDATION_ERROR");
  }

  const vehicleRef = doc(db, "vehicles", vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);

  if (!vehicleSnap.exists()) {
    throw new AppError("Pojazd nie istnieje", "NOT_FOUND");
  }

  const vehicleData = vehicleSnap.data();

  if (vehicleData.userId !== userId) {
    throw new AppError("Nie masz dostępu do tego pojazdu", "FORBIDDEN");
  }

  return {
    ref: vehicleRef,
    data: vehicleData
  };
}

async function getPreviousFuelRecord(vehicleId, currentMileage) {
  const user = requireAuth();

  const q = query(
    collection(db, "fuelRecords"),
    where("userId", "==", user.uid),
    where("vehicleId", "==", vehicleId),
    where("mileage", "<", Number(currentMileage)),
    orderBy("mileage", "desc"),
    limit(1)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  return {
    id: querySnapshot.docs[0].id,
    ...querySnapshot.docs[0].data()
  };
}

async function getFuelRecordById(recordId, userId) {
  if (!recordId) {
    throw new AppError("Brakuje identyfikatora wpisu", "VALIDATION_ERROR");
  }

  const recordRef = doc(db, "fuelRecords", recordId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) {
    throw new AppError("Wpis tankowania nie istnieje", "NOT_FOUND");
  }

  const recordData = recordSnap.data();

  if (recordData.userId !== userId) {
    throw new AppError("Nie masz dostępu do tego wpisu", "FORBIDDEN");
  }

  return {
    ref: recordRef,
    data: recordData
  };
}

export async function addFuelRecord(recordData) {
  try {
    const user = requireAuth();
    const validatedData = validateFuelRecordData(recordData);

    const vehicle = await getUserVehicle(validatedData.vehicleId, user.uid);
    const currentMileage = Number(vehicle.data.currentMileage || 0);

    if (Number(validatedData.mileage) <= currentMileage) {
      throw new AppError(
        `Przebieg musi być większy niż aktualny przebieg pojazdu (${currentMileage} km)`,
        "VALIDATION_ERROR",
        "mileage"
      );
    }

    const previousRecord = await getPreviousFuelRecord(
      validatedData.vehicleId,
      validatedData.mileage
    );

    let consumption = null;

    if (previousRecord) {
      consumption = calculateConsumption(
        Number(previousRecord.mileage),
        validatedData.mileage,
        validatedData.liters
      );
    }

    const docRef = await addDoc(collection(db, "fuelRecords"), {
      userId: user.uid,
      ...validatedData,
      consumption,
      createdAt: new Date()
    });

    await updateDoc(vehicle.ref, {
      currentMileage: validatedData.mileage
    });

    return {
      ok: true,
      data: {
        id: docRef.id,
        userId: user.uid,
        ...validatedData,
        consumption
      },
      error: null
    };
  } catch (error) {
    console.error("Add fuel record error:", error.message);

    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "ADD_FUEL_RECORD_ERROR",
        field: error.field || null
      }
    };
  }
}

export async function getFuelRecordsByVehicle(vehicleId) {
  try {
    const user = requireAuth();

    if (!vehicleId) {
      throw new AppError("Najpierw wybierz pojazd", "VALIDATION_ERROR");
    }

    const q = query(
      collection(db, "fuelRecords"),
      where("userId", "==", user.uid),
      where("vehicleId", "==", vehicleId),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(q);

    return {
      ok: true,
      data: querySnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      })),
      error: null
    };
  } catch (error) {
    console.error("Get fuel records error:", error.message);

    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "GET_FUEL_RECORDS_ERROR",
        field: error.field || null
      }
    };
  }
}

export async function deleteFuelRecord(recordId) {
  try {
    const user = requireAuth();

    const record = await getFuelRecordById(recordId, user.uid);
    await deleteDoc(record.ref);

    return {
      ok: true,
      data: true,
      error: null
    };
  } catch (error) {
    console.error("Delete fuel record error:", error.message);

    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "DELETE_FUEL_RECORD_ERROR",
        field: error.field || null
      }
    };
  }
}

export async function updateFuelRecord(recordId, updatedData) {
  try {
    const user = requireAuth();

    const record = await getFuelRecordById(recordId, user.uid);
    const validatedData = validateFuelRecordData(updatedData);

    if (record.data.vehicleId !== validatedData.vehicleId) {
      throw new AppError("Nie można przenieść tankowania do innego pojazdu", "VALIDATION_ERROR");
    }

    const previousRecord = await getPreviousFuelRecord(
      validatedData.vehicleId,
      validatedData.mileage
    );

    let consumption = null;

    if (previousRecord && previousRecord.id !== recordId) {
      consumption = calculateConsumption(
        Number(previousRecord.mileage),
        validatedData.mileage,
        validatedData.liters
      );
    }

    await updateDoc(record.ref, {
      ...validatedData,
      consumption,
      updatedAt: new Date()
    });

    const vehicle = await getUserVehicle(validatedData.vehicleId, user.uid);
    const currentMileage = Number(vehicle.data.currentMileage || 0);
    const oldMileage = Number(record.data.mileage || 0);

    if (oldMileage >= currentMileage || validatedData.mileage > currentMileage) {
      await updateDoc(vehicle.ref, {
        currentMileage: validatedData.mileage
      });
    }

    return {
      ok: true,
      data: true,
      error: null
    };
  } catch (error) {
    console.error("Update fuel record error:", error.message);

    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "UPDATE_FUEL_RECORD_ERROR",
        field: error.field || null
      }
    };
  }
}