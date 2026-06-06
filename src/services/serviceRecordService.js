import { auth, db } from "../firebase.js";
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
  orderBy
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import { AppError } from "../errors.js";
import { validateServiceRecordData } from "../validators.js";
import { storage } from "../firebase.js";

async function fetchFromCacheOrNetwork(q) {
  try { return await getDocsFromCache(q); } 
  catch (e) { return await getDocs(q); }
}

async function fetchDocFromCacheOrNetwork(docRef) {
  try { return await getDocFromCache(docRef); } 
  catch (e) { return await getDoc(docRef); }
}

function requireAuth() {
  const user = auth.currentUser;
  if (!user) throw new AppError("User is not authenticated", "AUTH_REQUIRED");
  return user;
}

function cleanData(obj) {
    const clean = {};
    for (const key in obj) {
        if (obj[key] !== undefined) clean[key] = obj[key];
    }
    return clean;
}

export async function uploadServiceAttachment(file, fileName = "attachment") {
  try {
    const user = requireAuth();
    if (!file) throw new AppError("File is required", "VALIDATION_ERROR");
    if (!navigator.onLine) throw new AppError("Brak internetu", "OFFLINE");

    const uniqueFileName = `${Date.now()}-${fileName}`;
    const storageRef = ref(storage, `service-records/${user.uid}/${uniqueFileName}`);

    const snapshot = await uploadBytes(storageRef, file);
    return { ok: true, data: await getDownloadURL(snapshot.ref), error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code || "UPLOAD_ATTACHMENT_ERROR" } };
  }
}

export async function addServiceRecord(recordData) {
  try {
    const user = requireAuth();
    const validatedData = validateServiceRecordData(recordData);

    const docRef = await addDoc(collection(db, "serviceRecords"), {
      userId: user.uid,
      ...cleanData(validatedData),
      createdAt: new Date()
    });

    const vehicleRef = doc(db, "vehicles", validatedData.vehicleId);
    await updateDoc(vehicleRef, { currentMileage: validatedData.mileage });

    return { ok: true, data: { id: docRef.id, userId: user.uid, ...validatedData }, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code || "ADD_SERVICE_RECORD_ERROR" } };
  }
}

export async function addServiceRecordWithAttachment(recordData, file, fileName) {
  try {
    let attachmentUrl = "";
    if (file) {
      const uploadResult = await uploadServiceAttachment(file, fileName);
      if (!uploadResult.ok) return uploadResult;
      attachmentUrl = uploadResult.data;
    }
    return await addServiceRecord({ ...recordData, attachmentUrl });
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code || "ADD_SERVICE_RECORD_WITH_ATTACHMENT_ERROR" } };
  }
}

export async function getServiceRecordsByVehicle(vehicleId) {
  try {
    const user = requireAuth();
    if (!vehicleId) throw new AppError("Vehicle ID is required", "VALIDATION_ERROR");

    const q = query(
      collection(db, "serviceRecords"),
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
    return { ok: false, data: null, error: { message: error.message, code: error.code || "GET_SERVICE_RECORDS_ERROR" } };
  }
}

export async function deleteServiceRecord(recordId) {
  try {
    requireAuth();
    if (!recordId) throw new AppError("Record ID is required", "VALIDATION_ERROR");
    
    const recordRef = doc(db, "serviceRecords", recordId);
    const docSnap = await fetchDocFromCacheOrNetwork(recordRef);
    if (docSnap.exists() && docSnap.data().attachmentUrl) {
        try { await deleteObject(ref(storage, docSnap.data().attachmentUrl)); } catch(e) {}
    }

    await deleteDoc(recordRef);
    return { ok: true, data: true, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code || "DELETE_SERVICE_RECORD_ERROR" } };
  }
}

export async function updateServiceRecord(recordId, updatedData) {
  try {
    requireAuth();
    if (!recordId) throw new AppError("Record ID is required", "VALIDATION_ERROR");

    const recordRef = doc(db, "serviceRecords", recordId);
    await updateDoc(recordRef, cleanData(updatedData));

    return { ok: true, data: true, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message, code: error.code || "UPDATE_SERVICE_RECORD_ERROR" } };
  }
}
