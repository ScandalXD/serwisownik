import { auth, db } from "../firebase.js";
import { collection, getDocs, query, where } from "firebase/firestore";
import { AppError } from "../errors.js";

function requireAuth() {
  const user = auth.currentUser;
  if (!user) throw new AppError("User is not authenticated", "AUTH_REQUIRED");
  return user;
}

function normalizeDate(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export async function getDueReminders() {
  try {
    const user = requireAuth();
    const remindersQuery = query(collection(db, "reminders"), where("userId", "==", user.uid));
    const vehiclesQuery = query(collection(db, "vehicles"), where("userId", "==", user.uid));

    const [remindersSnapshot, vehiclesSnapshot] = await Promise.all([
      getDocs(remindersQuery),
      getDocs(vehiclesQuery)
    ]);

    const reminders = remindersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const vehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

    const today = normalizeDate(new Date());

    const result = reminders.filter(reminder => {
      if (!reminder.isActive || !reminder.dueDate) return false;
      
      const daysAhead = Number(reminder.notifyDaysBefore || 30);
      const limitDate = new Date(today);
      limitDate.setDate(limitDate.getDate() + daysAhead);
      const dueDate = normalizeDate(reminder.dueDate);

      return dueDate >= today && dueDate <= limitDate;
    }).map(r => ({ ...r, vehicle: vehicleMap.get(r.vehicleId) }));

    return { ok: true, data: result, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message } };
  }
}

export async function getMileageDueReminders() {
  try {
    const user = requireAuth();
    const remindersQuery = query(collection(db, "reminders"), where("userId", "==", user.uid));
    const vehiclesQuery = query(collection(db, "vehicles"), where("userId", "==", user.uid));

    const [remindersSnapshot, vehiclesSnapshot] = await Promise.all([
      getDocs(remindersQuery),
      getDocs(vehiclesQuery)
    ]);

    const reminders = remindersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const vehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

    const result = reminders
      .filter((reminder) => {
        const vehicle = vehicleMap.get(reminder.vehicleId);

        if (!reminder.isActive || !reminder.dueMileage || !vehicle) return false;

        const currentM = Number(vehicle.currentMileage || 0);
        const dueM = Number(reminder.dueMileage);
        const notifyBefore = Number(reminder.notifyKmBefore || 0);

        return currentM >= (dueM - notifyBefore);
      })
      .map((reminder) => ({
        ...reminder,
        vehicle: vehicleMap.get(reminder.vehicleId)
      }));

    return {
      ok: true,
      data: result,
      error: null
    };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message } };
  }
}
