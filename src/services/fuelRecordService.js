import { auth, db, storage } from "../firebase.js";
import { ref, deleteObject } from "firebase/storage";
import {
  collection,
  addDoc,
  getDocs,
  getDocsFromCache,
  getDoc,
  getDocFromCache,
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
  if (!user) throw new AppError("User is not authenticated", "AUTH_REQUIRED");
  return user;
}

async function fetchFromCacheOrNetwork(q) {
    try {
        return await getDocsFromCache(q);
    } catch (e) {
        return await getDocs(q);
    }
}

async function fetchDocFromCacheOrNetwork(docRef) {
    try {
        return await getDocFromCache(docRef);
    } catch (e) {
        return await getDoc(docRef);
    }
}

function cleanData(obj) {
    const clean = {};
    for (const key in obj) {
        if (obj[key] !== undefined && obj[key] !== null) {
            clean[key] = obj[key];
        }
    }
    return clean;
}

function calculateConsumption(previousMileage, currentMileage, liters) {
  const distance = currentMileage - previousMileage;
  if (distance <= 0) return null;
  return Number(((Number(liters) / distance) * 100).toFixed(2));
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

  const querySnapshot = await fetchFromCacheOrNetwork(q);
  if (querySnapshot.empty) return null;

  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
}

export async function addFuelRecord(recordData) {
  try {
    const user = requireAuth();
    const validatedData = validateFuelRecordData(recordData);

    const vehicleRef = doc(db, "vehicles", validatedData.vehicleId);
    const vehicleSnap = await fetchDocFromCacheOrNetwork(vehicleRef);

    if (!vehicleSnap.exists()) throw new AppError("Pojazd nie istnieje", "NOT_FOUND");
    const vehicleData = vehicleSnap.data();

    if (Number(validatedData.mileage) <= Number(vehicleData.currentMileage)) {
      throw new AppError(`Przebieg musi być większy niż aktualny (${vehicleData.currentMileage} km)`, "VALIDATION_ERROR");
    }

    const previousRecord = await getPreviousFuelRecord(validatedData.vehicleId, validatedData.mileage);
    let consumption = previousRecord ? calculateConsumption(Number(previousRecord.mileage), validatedData.mileage, validatedData.liters) : null;

    const docRef = await addDoc(collection(db, "fuelRecords"), cleanData({
      userId: user.uid,
      ...validatedData,
      consumption,
      createdAt: new Date()
    }));

    await updateDoc(vehicleRef, { currentMileage: validatedData.mileage });
  
    return { ok: true, data: { id: docRef.id, userId: user.uid, ...validatedData, consumption }, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code || "ADD_FUEL_RECORD_ERROR" } };
  }
}

export async function getFuelRecordsByVehicle(vehicleId) {
  try {
    const user = requireAuth();
    if (!vehicleId) throw new AppError("Vehicle ID is required", "VALIDATION_ERROR");

    const q = query(
      collection(db, "fuelRecords"),
      where("userId", "==", user.uid),
      where("vehicleId", "==", vehicleId),
      orderBy("date", "desc")
    );

    const querySnapshot = await fetchFromCacheOrNetwork(q);
    return {
      ok: true,
      data: querySnapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })),
      error: null
    };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code || "GET_FUEL_RECORDS_ERROR" } };
  }
}

export async function deleteFuelRecord(recordId) {
  try {
    requireAuth();
    if (!recordId) throw new AppError("Record ID is required", "VALIDATION_ERROR");

    const recordRef = doc(db, "fuelRecords", recordId);
    const docSnap = await fetchDocFromCacheOrNetwork(recordRef);

    if (docSnap.exists() && docSnap.data().attachmentUrl) {
      try { await deleteObject(ref(storage, docSnap.data().attachmentUrl)); } catch (e) {}
    }

    await deleteDoc(recordRef);
    return { ok: true, data: true, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code || "DELETE_FUEL_RECORD_ERROR" } };
  }
}

export async function updateFuelRecord(recordId, updatedData) {
  try {
    requireAuth();
    if (!recordId) throw new AppError("Record ID is required", "VALIDATION_ERROR");

    const recordRef = doc(db, "fuelRecords", recordId);
    const docSnap = await fetchDocFromCacheOrNetwork(recordRef);

    if (!docSnap.exists()) throw new AppError("Wpis nie istnieje.", "NOT_FOUND");

    const oldData = docSnap.data();
    const dataToUpdate = cleanData({ ...updatedData });

    if (dataToUpdate.attachmentUrl && dataToUpdate.attachmentUrl !== oldData.attachmentUrl) {
      if (oldData.attachmentUrl) try { await deleteObject(ref(storage, oldData.attachmentUrl)); } catch(e) {}
    } else if (dataToUpdate.attachmentUrl === null && oldData.attachmentUrl) {
      try { await deleteObject(ref(storage, oldData.attachmentUrl)); } catch(e) {}
    }

    await updateDoc(recordRef, dataToUpdate);
    return { ok: true, data: true, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code || "UPDATE_FUEL_RECORD_ERROR" } };
  }
}
