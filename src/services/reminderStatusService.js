import { auth, db } from "../firebase.js";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { AppError } from "../errors.js";

function requireAuth() {
  const user = auth.currentUser;

  if (!user) {
    throw new AppError("User is not authenticated", "AUTH_REQUIRED");
  }

  return user;
}

function normalizeDate(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export async function getDueReminders(daysAhead = 30) {
  try {
    const user = requireAuth();

    const remindersQuery = query(
      collection(db, "reminders"),
      where("userId", "==", user.uid)
    );

    const vehiclesQuery = query(
      collection(db, "vehicles"),
      where("userId", "==", user.uid)
    );

    const [remindersSnapshot, vehiclesSnapshot] = await Promise.all([
      getDocs(remindersQuery),
      getDocs(vehiclesQuery)
    ]);

    const reminders = remindersSnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    const vehicles = vehiclesSnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

    const today = normalizeDate(new Date());
    const limitDate = normalizeDate(new Date());
    limitDate.setDate(limitDate.getDate() + Number(daysAhead));

    const dueReminders = reminders.filter((reminder) => {
      if (!reminder.isActive) {
        return false;
      }

      if (!reminder.dueDate) {
        return false;
      }

      const dueDate = normalizeDate(reminder.dueDate);
      return dueDate >= today && dueDate <= limitDate;
    });

    const result = dueReminders.map((reminder) => {
      const vehicle = vehicleMap.get(reminder.vehicleId) || null;

      return {
        ...reminder,
        vehicle: vehicle
          ? {
              id: vehicle.id,
              brand: vehicle.brand,
              model: vehicle.model,
              year: vehicle.year,
              currentMileage: vehicle.currentMileage
            }
          : null
      };
    });

    return {
      ok: true,
      data: result,
      error: null
    };
  } catch (error) {
    console.error("Get due reminders error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "GET_DUE_REMINDERS_ERROR"
      }
    };
  }
}

export async function getMileageDueReminders() {
  try {
    const user = requireAuth();

    const remindersQuery = query(
      collection(db, "reminders"),
      where("userId", "==", user.uid)
    );

    const vehiclesQuery = query(
      collection(db, "vehicles"),
      where("userId", "==", user.uid)
    );

    const [remindersSnapshot, vehiclesSnapshot] = await Promise.all([
      getDocs(remindersQuery),
      getDocs(vehiclesQuery)
    ]);

    const reminders = remindersSnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    const vehicles = vehiclesSnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

    const result = reminders
      .filter((reminder) => reminder.isActive && reminder.dueMileage !== null && reminder.dueMileage !== undefined)
      .filter((reminder) => {
        const vehicle = vehicleMap.get(reminder.vehicleId);
        if (!vehicle) {
          return false;
        }

        return Number(vehicle.currentMileage) >= Number(reminder.dueMileage);
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
    console.error("Get mileage due reminders error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "GET_MILEAGE_DUE_REMINDERS_ERROR"
      }
    };
  }
}