import { auth, db, storage } from "../firebase.js";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  deleteField
} from "firebase/firestore";
import { AppError } from "../errors.js";

async function fetchFromCacheOrNetwork(q) {
  try { return await getDocsFromCache(q); } 
  catch (e) { return await getDocs(q); }
}

function requireAuth() {
  const user = auth.currentUser;
  if (!user) throw new AppError("Użytkownik nie jest zalogowany", "AUTH_REQUIRED");
  return user;
}

async function uploadVehiclePhoto(file, userId) {
  if (!navigator.onLine) throw new AppError("Brak połączenia z internetem", "OFFLINE");
  const fileName = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `users/${userId}/vehicles/${fileName}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

export async function syncVehicleMileage(vehicleId, newMileage) {
  try {
    const vehicleRef = doc(db, "vehicles", vehicleId);
    await updateDoc(vehicleRef, { 
      currentMileage: Number(newMileage),
      updatedAt: new Date()
    });
    return { ok: true };
  } catch (error) {
    console.error("Błąd synchronizacji przebiegu:", error);
    return { ok: false, error };
  }
}

export async function getVehicles() {
  try {
    const user = requireAuth();
    const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
    
    const snapshot = await fetchFromCacheOrNetwork(q);
    
    return {
      ok: true,
      data: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
      error: null
    };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message } };
  }
}

export async function addVehicle(vehicleData, photoFile = null) {
  try {
    const user = requireAuth();
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 1; 
    const inputYear = Number(vehicleData.year);

    if (inputYear > maxYear) {
      throw new AppError(`Rok produkcji (${inputYear}) nie może być większy niż ${maxYear}.`, "INVALID_YEAR");
    }

    let photoUrl = null;
    if (photoFile) {
      photoUrl = await uploadVehiclePhoto(photoFile, user.uid);
    }

    const docRef = await addDoc(collection(db, "vehicles"), {
      userId: user.uid,
      brand: vehicleData.brand,
      model: vehicleData.model,
      year: inputYear,
      currentMileage: Number(vehicleData.currentMileage),
      photoUrl: photoUrl,
      createdAt: new Date()
    });

    return { ok: true, data: { id: docRef.id, ...vehicleData, photoUrl }, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code } };
  }
}

export async function deleteVehicle(vehicleId) {
  try {
    requireAuth();
    await deleteDoc(doc(db, "vehicles", vehicleId));
    return { ok: true, data: true, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message } };
  }
}

export async function updateVehicle(vehicleId, updatedData, photoFile = null, removePhoto = false) {
  try {
    const user = requireAuth(); 
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 1;
    const inputYear = Number(updatedData.year);

    if (inputYear > maxYear) {
      throw new AppError(`Rok produkcji (${inputYear}) nie może być większy niż ${maxYear}.`, "INVALID_YEAR");
    }

    let photoUrl = null;
    if (photoFile && !removePhoto) {
      photoUrl = await uploadVehiclePhoto(photoFile, user.uid);
    }

    const vehicleRef = doc(db, "vehicles", vehicleId);
    const updatePayload = {
      brand: updatedData.brand,
      model: updatedData.model,
      year: inputYear,
      currentMileage: Number(updatedData.currentMileage),
      updatedAt: new Date()
    };

    if (removePhoto) {
      updatePayload.photoUrl = deleteField();
    } else if (photoUrl) {
      updatePayload.photoUrl = photoUrl;
    }
    
    await updateDoc(vehicleRef, updatePayload);
    return { ok: true, data: { id: vehicleId, ...updatedData }, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code } };
  }
}
