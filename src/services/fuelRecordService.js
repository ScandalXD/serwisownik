import { auth, db, storage } from "../firebase.js";
import { ref, deleteObject } from "firebase/storage";
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
    throw new AppError("User is not authenticated", "AUTH_REQUIRED");
  }
  return user;
}

function calculateConsumption(previousMileage, currentMileage, liters) {
  const distance = currentMileage - previousMileage;

  if (distance <= 0) {
    return null;
  }

  const consumption = (Number(liters) / distance) * 100;
  return Number(consumption.toFixed(2));
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

export async function addFuelRecord(recordData) {
  try {
    const user = requireAuth();
    const validatedData = validateFuelRecordData(recordData);

    const vehicleRef = doc(db, "vehicles", validatedData.vehicleId);
    const vehicleSnap = await getDoc(vehicleRef);

    if (!vehicleSnap.exists()) {
      throw new AppError("Pojazd nie istnieje", "NOT_FOUND");
    }

    const vehicleData = vehicleSnap.data();

    if (Number(validatedData.mileage) <= Number(vehicleData.currentMileage)) {
      throw new AppError(
        `Przebieg musi być większy niż aktualny przebieg pojazdu (${vehicleData.currentMileage} km)`, 
        "VALIDATION_ERROR"
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

    await updateDoc(vehicleRef, {
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
        code: error.code || "ADD_FUEL_RECORD_ERROR" 
      } 
    };
  }
}

export async function getFuelRecordsByVehicle(vehicleId) {
  try {
    const user = requireAuth();

    if (!vehicleId) {
      throw new AppError("Vehicle ID is required", "VALIDATION_ERROR");
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
        code: error.code || "GET_FUEL_RECORDS_ERROR"
      }
    };
  }
}

export async function deleteFuelRecord(recordId) {
  try {
    requireAuth();

    if (!recordId) {
      throw new AppError("Record ID is required", "VALIDATION_ERROR");
    }

    const recordRef = doc(db, "fuelRecords", recordId);
    const docSnap = await getDoc(recordRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.attachmentUrl) {
        try {
          await deleteObject(ref(storage, data.attachmentUrl));
        } catch (e) {
          console.warn("Nie udało się usunąć starego załącznika ze Storage", e);
        }
      }
    }

    await deleteDoc(recordRef);

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
        code: error.code || "DELETE_FUEL_RECORD_ERROR"
      }
    };
  }
}

export async function updateFuelRecord(recordId, updatedData) {
  try {
    requireAuth();

    if (!recordId) {
      throw new AppError("Record ID is required", "VALIDATION_ERROR");
    }

    const recordRef = doc(db, "fuelRecords", recordId);
    const docSnap = await getDoc(recordRef);

    if (!docSnap.exists()) {
      throw new AppError("Wpis nie istnieje.", "NOT_FOUND");
    }

    const oldData = docSnap.data();
    const dataToUpdate = { ...updatedData };

    if (dataToUpdate.attachmentUrl && dataToUpdate.attachmentUrl !== oldData.attachmentUrl) {
      if (oldData.attachmentUrl) {
        try { await deleteObject(ref(storage, oldData.attachmentUrl)); } catch(e) {}
      }
    } 
    else if (dataToUpdate.attachmentUrl === null) {
      if (oldData.attachmentUrl) {
        try { await deleteObject(ref(storage, oldData.attachmentUrl)); } catch(e) {}
      }
    }

    await updateDoc(recordRef, dataToUpdate);

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
        code: error.code || "UPDATE_FUEL_RECORD_ERROR"
      }
    };
  }
}
