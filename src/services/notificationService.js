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
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { AppError } from "../errors.js";
import { getDueReminders, getMileageDueReminders } from "./reminderStatusService.js";

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

function buildNotificationKey(type, reminderId) {
  return `${type}_${reminderId}`;
}

export async function createNotification(notificationData) {
  try {
    const user = requireAuth();
    if (!notificationData?.type || !notificationData?.title) {
      throw new AppError("Notification type and title are required", "VALIDATION_ERROR");
    }

    const docRef = await addDoc(collection(db, "notifications"), {
      userId: user.uid,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message || "",
      vehicleId: notificationData.vehicleId || null,
      vehicleName: notificationData.vehicleName || null,
      reminderId: notificationData.reminderId || null,
      notificationKey: notificationData.notificationKey || null,
      isRead: false,
      createdAt: serverTimestamp()
    });

    return {
      ok: true,
      data: { id: docRef.id, userId: user.uid, ...notificationData, isRead: false },
      error: null
    };
  } catch (error) {
    console.error("Create notification error:", error.message);
    return {
      ok: false,
      data: null,
      error: { message: error.message, code: error.code || "CREATE_NOTIFICATION_ERROR" }
    };
  }
}

export async function getMyNotifications(options = {}) {
  try {
    const user = requireAuth();
    const constraints = [where("userId", "==", user.uid)];

    if (options.onlyUnread) constraints.push(where("isRead", "==", false));
    constraints.push(orderBy("createdAt", "desc"));
    if (options.limit) constraints.push(limit(Number(options.limit)));

    const q = query(collection(db, "notifications"), ...constraints);
    
    const snapshot = await fetchFromCacheOrNetwork(q);

    return {
      ok: true,
      data: snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })),
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: { message: error.message, code: error.code || "GET_MY_NOTIFICATIONS_ERROR" }
    };
  }
}

export async function markNotificationAsRead(notificationId) {
  try {
    const user = requireAuth();
    if (!notificationId) throw new AppError("ID required", "VALIDATION_ERROR");

    const notificationRef = doc(db, "notifications", notificationId);
    const notificationSnap = await fetchDocFromCacheOrNetwork(notificationRef);

    if (!notificationSnap.exists()) throw new AppError("Notification not found", "NOT_FOUND");
    if (notificationSnap.data().userId !== user.uid) throw new AppError("Access denied", "FORBIDDEN");

    await updateDoc(notificationRef, { isRead: true });
    return { ok: true, data: true, error: null };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: { message: error.message, code: error.code || "MARK_NOTIFICATION_AS_READ_ERROR" }
    };
  }
}

export async function deleteNotification(notificationId) {
  try {
    const user = requireAuth();
    if (!notificationId) throw new AppError("ID required", "VALIDATION_ERROR");

    const notificationRef = doc(db, "notifications", notificationId);
    const notificationSnap = await fetchDocFromCacheOrNetwork(notificationRef);

    if (!notificationSnap.exists()) throw new AppError("Notification not found", "NOT_FOUND");
    if (notificationSnap.data().userId !== user.uid) throw new AppError("Access denied", "FORBIDDEN");

    await deleteDoc(notificationRef);
    return { ok: true, data: true, error: null };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: { message: error.message, code: error.code || "DELETE_NOTIFICATION_ERROR" }
    };
  }
}

export async function generateReminderNotifications() {
  try {
    requireAuth();

    const [dateResult, mileageResult, existingNotificationsResult] = await Promise.all([
      getDueReminders(30),
      getMileageDueReminders(),
      getMyNotifications({ limit: 200 })
    ]);

    if (!dateResult.ok || !mileageResult.ok || !existingNotificationsResult.ok) {
        throw new AppError("Error fetching data for notifications", "FETCH_ERROR");
    }

    const existingKeys = new Set(
      existingNotificationsResult.data
        .map((item) => item.notificationKey)
        .filter(Boolean)
    );

    const created = [];
    for (const reminder of dateResult.data) {
      const key = buildNotificationKey("DATE_REMINDER", reminder.id);
      if (!existingKeys.has(key)) {
        const result = await createNotification({
          type: "DATE_REMINDER", title: reminder.title,
          message: `Zbliża się zaplanowany termin: ${reminder.dueDate}`,
          vehicleId: reminder.vehicleId, vehicleName: reminder.vehicleName, notificationKey: key
        });
        if (result.ok) { created.push(result.data); existingKeys.add(key); }
      }
    }

    for (const reminder of mileageResult.data) {
      const key = buildNotificationKey("MILEAGE_REMINDER", reminder.id);
      if (!existingKeys.has(key)) {
        const result = await createNotification({
          type: "MILEAGE_REMINDER", title: reminder.title,
          message: `Osiągnięto zaplanowany przebieg: ${reminder.dueMileage} km`,
          vehicleId: reminder.vehicleId, vehicleName: reminder.vehicleName, reminderId: reminder.id, notificationKey: key
        });
        if (result.ok) { created.push(result.data); existingKeys.add(key); }
      }
    }

    return { ok: true, data: created, error: null };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: { message: error.message, code: error.code || "GENERATE_REMINDER_NOTIFICATIONS_ERROR" }
    };
  }
}
