import { auth, db } from "../firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { AppError } from "../errors.js";
import {
  validateReminderData,
  validateReminderUpdateData
} from "../validators.js";

function requireAuth() {
  const user = auth.currentUser;

  if (!user) {
    throw new AppError("User is not authenticated", "AUTH_REQUIRED");
  }

  return user;
}

export async function addReminder(reminderData) {
  try {
    const user = requireAuth();
    const validatedData = validateReminderData(reminderData);

    const docRef = await addDoc(collection(db, "reminders"), {
      userId: user.uid,
      ...validatedData,
      createdAt: new Date()
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
    console.error("Add reminder error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "ADD_REMINDER_ERROR"
      }
    };
  }
}

export async function getRemindersByVehicle(vehicleId) {
  try {
    const user = requireAuth();

    if (!vehicleId) {
      throw new AppError("Vehicle ID is required", "VALIDATION_ERROR");
    }

    const q = query(
      collection(db, "reminders"),
      where("userId", "==", user.uid),
      where("vehicleId", "==", vehicleId),
      orderBy("dueDate", "asc")
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
    console.error("Get reminders error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "GET_REMINDERS_ERROR"
      }
    };
  }
}

export async function updateReminder(reminderId, updatedData) {
  try {
    requireAuth();

    if (!reminderId) {
      throw new AppError("Reminder ID is required", "VALIDATION_ERROR");
    }

    const validatedData = validateReminderUpdateData(updatedData);
    const reminderRef = doc(db, "reminders", reminderId);

    await updateDoc(reminderRef, validatedData);

    return {
      ok: true,
      data: true,
      error: null
    };
  } catch (error) {
    console.error("Update reminder error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "UPDATE_REMINDER_ERROR"
      }
    };
  }
}

export async function deleteReminder(reminderId) {
  try {
    requireAuth();

    if (!reminderId) {
      throw new AppError("Reminder ID is required", "VALIDATION_ERROR");
    }

    const reminderRef = doc(db, "reminders", reminderId);
    await deleteDoc(reminderRef);

    return {
      ok: true,
      data: true,
      error: null
    };
  } catch (error) {
    console.error("Delete reminder error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "DELETE_REMINDER_ERROR"
      }
    };
  }
}