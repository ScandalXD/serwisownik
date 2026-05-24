import { auth, db, storage } from "../firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  deleteDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { AppError } from "../errors.js";

const MAX_PHOTO_SIZE_MB = 5;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

function requireAuth() {
  const user = auth.currentUser;

  if (!user) {
    throw new AppError(
      "Musisz być zalogowany, aby wykonać tę operację.",
      "AUTH_REQUIRED",
    );
  }

  return user;
}

function validatePhotoFile(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    throw new AppError(
      "Plik musi być obrazem, np. JPG, PNG albo WEBP.",
      "VALIDATION_ERROR",
      "photo",
    );
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    throw new AppError(
      `Zdjęcie jest za duże. Maksymalny rozmiar to ${MAX_PHOTO_SIZE_MB} MB.`,
      "VALIDATION_ERROR",
      "photo",
    );
  }
}

async function getUserVehicle(vehicleId, userId) {
  if (!vehicleId) {
    throw new AppError("Brakuje identyfikatora pojazdu.", "VALIDATION_ERROR");
  }

  const vehicleRef = doc(db, "vehicles", vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);

  if (!vehicleSnap.exists()) {
    throw new AppError("Pojazd nie istnieje.", "NOT_FOUND");
  }

  const vehicleData = vehicleSnap.data();

  if (vehicleData.userId !== userId) {
    throw new AppError("Nie masz dostępu do tego pojazdu.", "FORBIDDEN");
  }

  return {
    ref: vehicleRef,
    data: vehicleData,
  };
}

async function uploadVehiclePhoto(file, userId) {
  validatePhotoFile(file);

  const safeFileName = file.name.replace(/[^\w.-]/g, "_");
  const fileName = `${Date.now()}_${safeFileName}`;
  const storageRef = ref(storage, `users/${userId}/vehicles/${fileName}`);

  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
}

export async function getVehicles() {
  try {
    const user = requireAuth();

    const q = query(
      collection(db, "vehicles"),
      where("userId", "==", user.uid),
    );

    const snapshot = await getDocs(q);

    return {
      ok: true,
      data: snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      })),
      error: null,
    };
  } catch (error) {
    console.error("Get vehicles error:", error.message);

    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "GET_VEHICLES_ERROR",
        field: error.field || null,
      },
    };
  }
}

export async function addVehicle(vehicleData, photoFile = null) {
  try {
    const user = requireAuth();

    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 1;
    const inputYear = Number(vehicleData.year);

    if (inputYear > maxYear) {
      throw new AppError(
        `Rok produkcji (${inputYear}) nie może być większy niż ${maxYear}.`,
        "VALIDATION_ERROR",
        "year",
      );
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
      photoUrl,
      createdAt: new Date(),
    });

    return {
      ok: true,
      data: {
        id: docRef.id,
        userId: user.uid,
        ...vehicleData,
        year: inputYear,
        currentMileage: Number(vehicleData.currentMileage),
        photoUrl,
      },
      error: null,
    };
  } catch (error) {
    console.error("Add vehicle error:", error.message);

    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "ADD_VEHICLE_ERROR",
        field: error.field || null,
      },
    };
  }
}

export async function deleteVehicle(vehicleId) {
  try {
    const user = requireAuth();

    const vehicle = await getUserVehicle(vehicleId, user.uid);
    await deleteDoc(vehicle.ref);

    return {
      ok: true,
      data: true,
      error: null,
    };
  } catch (error) {
    console.error("Delete vehicle error:", error.message);

    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "DELETE_VEHICLE_ERROR",
        field: error.field || null,
      },
    };
  }
}

export async function updateVehicle(
  vehicleId,
  updatedData,
  photoFile = null,
  removePhoto = false,
) {
  try {
    const user = requireAuth();

    const vehicle = await getUserVehicle(vehicleId, user.uid);

    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 1;
    const inputYear = Number(updatedData.year);

    if (inputYear > maxYear) {
      throw new AppError(
        `Rok produkcji (${inputYear}) nie może być większy niż ${maxYear}.`,
        "VALIDATION_ERROR",
        "year",
      );
    }

    let photoUrl = null;

    if (photoFile && !removePhoto) {
      photoUrl = await uploadVehiclePhoto(photoFile, user.uid);
    }

    const updatePayload = {
      brand: updatedData.brand,
      model: updatedData.model,
      year: inputYear,
      updatedAt: new Date(),
    };

    if (removePhoto) {
      updatePayload.photoUrl = deleteField();
    } else if (photoUrl) {
      updatePayload.photoUrl = photoUrl;
    }

    await updateDoc(vehicle.ref, updatePayload);

    return {
      ok: true,
      data: {
        id: vehicleId,
        ...updatedData,
        year: inputYear,
        currentMileage: Number(vehicle.data.currentMileage || 0),
        photoUrl: photoUrl || vehicle.data.photoUrl || null,
      },
      error: null,
    };
  } catch (error) {
    console.error("Update vehicle error:", error.message);

    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "UPDATE_VEHICLE_ERROR",
        field: error.field || null,
      },
    };
  }
}
