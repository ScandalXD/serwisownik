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
  orderBy
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";
import { storage } from "../firebase.js";
import { AppError } from "../errors.js";
import { validateServiceRecordData } from "../validators.js";

function requireAuth() {
  const user = auth.currentUser;

  if (!user) {
    throw new AppError("Musisz być zalogowany, aby wykonać tę operację.", "AUTH_REQUIRED");
  }

  return user;
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

export async function uploadServiceAttachment(file, fileName = "attachment") {
  try {
    const user = requireAuth();

    if (!file) {
      throw new AppError("Plik jest wymagany", "VALIDATION_ERROR");
    }

    const uniqueFileName = `${Date.now()}-${fileName}`;
    const storageRef = ref(storage, `service-records/${user.uid}/${uniqueFileName}`);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      ok: true,
      data: downloadURL,
      error: null
    };
  } catch (error) {
    console.error("Upload attachment error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "UPLOAD_ATTACHMENT_ERROR",
        field: error.field || null
      }
    };
  }
}

export async function addServiceRecord(recordData) {
  try {
    const user = requireAuth();
    const validatedData = validateServiceRecordData(recordData);

    const vehicle = await getUserVehicle(validatedData.vehicleId, user.uid);
    const currentMileage = Number(vehicle.data.currentMileage || 0);

    if (validatedData.mileage < currentMileage) {
      throw new AppError(
        `Przebieg nie może być mniejszy niż aktualny przebieg pojazdu (${currentMileage} km)`,
        "VALIDATION_ERROR",
        "mileage"
      );
    }

    const docRef = await addDoc(collection(db, "serviceRecords"), {
      userId: user.uid,
      ...validatedData,
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
        ...validatedData
      },
      error: null
    };
  } catch (error) {
    console.error("Add service record error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "ADD_SERVICE_RECORD_ERROR",
        field: error.field || null
      }
    };
  }
}

export async function addServiceRecordWithAttachment(recordData, file, fileName) {
  try {
    let attachmentUrl = "";

    if (file) {
      const uploadResult = await uploadServiceAttachment(file, fileName);

      if (!uploadResult.ok) {
        return uploadResult;
      }

      attachmentUrl = uploadResult.data;
    }

    return await addServiceRecord({
      ...recordData,
      attachmentUrl
    });
  } catch (error) {
    console.error("Add service record with attachment error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "ADD_SERVICE_RECORD_WITH_ATTACHMENT_ERROR",
        field: error.field || null
      }
    };
  }
}

export async function getServiceRecordsByVehicle(vehicleId) {
  try {
    const user = requireAuth();

    if (!vehicleId) {
      throw new AppError("Najpierw wybierz pojazd", "VALIDATION_ERROR");
    }

    const q = query(
      collection(db, "serviceRecords"),
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
    console.error("Get service records error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "GET_SERVICE_RECORDS_ERROR",
        field: error.field || null
      }
    };
  }
}

export async function deleteServiceRecord(recordId) {
  try {
    requireAuth();

    if (!recordId) {
      throw new AppError("Brakuje identyfikatora wpisu", "VALIDATION_ERROR");
    }

    const recordRef = doc(db, "serviceRecords", recordId);
    await deleteDoc(recordRef);

    return {
      ok: true,
      data: true,
      error: null
    };
  } catch (error) {
    console.error("Delete service record error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "DELETE_SERVICE_RECORD_ERROR",
        field: error.field || null
      }
    };
  }
}

export async function updateServiceRecord(recordId, updatedData) {
  try {
    const user = requireAuth();

    if (!recordId) {
      throw new AppError("Brakuje identyfikatora wpisu", "VALIDATION_ERROR");
    }

    const validatedData = validateServiceRecordData(updatedData);
    const vehicle = await getUserVehicle(validatedData.vehicleId, user.uid);
    const currentMileage = Number(vehicle.data.currentMileage || 0);

    if (validatedData.mileage < currentMileage) {
      throw new AppError(
        `Przebieg nie może być mniejszy niż aktualny przebieg pojazdu (${currentMileage} km)`,
        "VALIDATION_ERROR",
        "mileage"
      );
    }

    const recordRef = doc(db, "serviceRecords", recordId);
    await updateDoc(recordRef, validatedData);

    await updateDoc(vehicle.ref, {
      currentMileage: validatedData.mileage
    });

    return {
      ok: true,
      data: true,
      error: null
    };
  } catch (error) {
    console.error("Update service record error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "UPDATE_SERVICE_RECORD_ERROR",
        field: error.field || null
      }
    };
  }
}