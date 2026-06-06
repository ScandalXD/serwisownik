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
import { AppError } from "../errors.js";
import { validateReminderData, validateReminderUpdateData } from "../validators.js";

async function fetchFromCacheOrNetwork(q) {
  try { return await getDocsFromCache(q); } 
  catch (e) { return await getDocs(q); }
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

export async function addReminder(reminderData) {
  try {
    const user = requireAuth();
    const validatedData = validateReminderData(reminderData);

    const docRef = await addDoc(collection(db, "reminders"), {
      userId: user.uid,
      ...cleanData(validatedData),
      createdAt: new Date()
    });

    return {
      ok: true,
      data: { id: docRef.id, userId: user.uid, ...validatedData },
      error: null
    };
  } catch (error) {
    console.error("Add reminder error:", error.message);
    return {
      ok: false,
      data: null,
      error: { message: error.message, code: error.code || "ADD_REMINDER_ERROR" }
    };
  }
}

export async function getRemindersByVehicle(vehicleId) {
  try {
    const user = requireAuth();
    if (!vehicleId) throw new AppError("Vehicle ID is required", "VALIDATION_ERROR");

    const q = query(
      collection(db, "reminders"),
      where("userId", "==", user.uid),
      where("vehicleId", "==", vehicleId)
    );

    const querySnapshot = await fetchFromCacheOrNetwork(q);

    const reminders = querySnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    reminders.sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

    return { ok: true, data: reminders, error: null };
  } catch (error) {
    console.error("Get reminders error:", error.message);
    return {
      ok: false,
      data: null,
      error: { message: error.message, code: error.code || "GET_REMINDERS_ERROR" }
    };
  }
}

export async function updateReminder(reminderId, updatedData) {
  try {
    requireAuth();
    if (!reminderId) throw new AppError("Reminder ID is required", "VALIDATION_ERROR");

    const validatedData = validateReminderUpdateData(updatedData);
    const reminderRef = doc(db, "reminders", reminderId);

    await updateDoc(reminderRef, cleanData(validatedData));

    return { ok: true, data: true, error: null };
  } catch (error) {
    console.error("Update reminder error:", error.message);
    return {
      ok: false,
      data: null,
      error: { message: error.message, code: error.code || "UPDATE_REMINDER_ERROR" }
    };
  }
}

export async function deleteReminder(reminderId) {
  try {
    requireAuth();
    if (!reminderId) throw new AppError("Reminder ID is required", "VALIDATION_ERROR");

    const reminderRef = doc(db, "reminders", reminderId);
    await deleteDoc(reminderRef);

    return { ok: true, data: true, error: null };
  } catch (error) {
    console.error("Delete reminder error:", error.message);
    return {
      ok: false,
      data: null,
      error: { message: error.message, code: error.code || "DELETE_REMINDER_ERROR" }
    };
  }
}
