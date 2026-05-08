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

function isDateInRange(dateValue, startDate, endDate) {
  if (!dateValue) {
    return false;
  }

  const current = new Date(dateValue);
  const start = new Date(startDate);
  const end = new Date(endDate);

  return current >= start && current <= end;
}

function sumCosts(items) {
  return items.reduce((sum, item) => sum + Number(item.cost || 0), 0);
}

export async function getVehicleCostsSummary(vehicleId, startDate, endDate) {
  try {
    const user = requireAuth();

    if (!vehicleId) {
      throw new AppError("Vehicle ID is required", "VALIDATION_ERROR");
    }

    if (!startDate || !endDate) {
      throw new AppError("Start date and end date are required", "VALIDATION_ERROR");
    }

    const serviceQuery = query(
      collection(db, "serviceRecords"),
      where("userId", "==", user.uid),
      where("vehicleId", "==", vehicleId)
    );

    const fuelQuery = query(
      collection(db, "fuelRecords"),
      where("userId", "==", user.uid),
      where("vehicleId", "==", vehicleId)
    );

    const reminderQuery = query(
      collection(db, "reminders"),
      where("userId", "==", user.uid),
      where("vehicleId", "==", vehicleId)
    );

    const [serviceSnapshot, fuelSnapshot, reminderSnapshot] = await Promise.all([
      getDocs(serviceQuery),
      getDocs(fuelQuery),
      getDocs(reminderQuery)
    ]);

    const serviceRecords = serviceSnapshot.docs
      .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
      .filter((item) => isDateInRange(item.date, startDate, endDate));

    const fuelRecords = fuelSnapshot.docs
      .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
      .filter((item) => isDateInRange(item.date, startDate, endDate));

    const reminders = reminderSnapshot.docs
      .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
      .filter((item) => item.dueDate && isDateInRange(item.dueDate, startDate, endDate));

    const serviceTotal = Number(sumCosts(serviceRecords).toFixed(2));
    const fuelTotal = Number(sumCosts(fuelRecords).toFixed(2));

    const total = Number((serviceTotal + fuelTotal).toFixed(2));

    return {
      ok: true,
      data: {
        vehicleId,
        period: {
          startDate,
          endDate
        },
        totals: {
          service: serviceTotal,
          fuel: fuelTotal,
          total
        },
        counts: {
          serviceRecords: serviceRecords.length,
          fuelRecords: fuelRecords.length,
          reminders: reminders.length
        },
        serviceRecords,
        fuelRecords,
        reminders
      },
      error: null
    };
  } catch (error) {
    console.error("Get vehicle costs summary error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "GET_VEHICLE_COSTS_SUMMARY_ERROR"
      }
    };
  }
}

export async function getAllVehiclesCostsSummary(startDate, endDate) {
  try {
    const user = requireAuth();

    if (!startDate || !endDate) {
      throw new AppError("Start date and end date are required", "VALIDATION_ERROR");
    }

    const vehiclesQuery = query(
      collection(db, "vehicles"),
      where("userId", "==", user.uid)
    );

    const vehiclesSnapshot = await getDocs(vehiclesQuery);
    const vehicles = vehiclesSnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    const summaries = [];

    for (const vehicle of vehicles) {
      const summaryResult = await getVehicleCostsSummary(vehicle.id, startDate, endDate);

      if (summaryResult.ok) {
        summaries.push({
          vehicle: {
            id: vehicle.id,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year
          },
          totals: summaryResult.data.totals,
          counts: summaryResult.data.counts
        });
      }
    }

    const totalService = Number(
      summaries.reduce((sum, item) => sum + item.totals.service, 0).toFixed(2)
    );
    const totalFuel = Number(
      summaries.reduce((sum, item) => sum + item.totals.fuel, 0).toFixed(2)
    );
    const grandTotal = Number((totalService + totalFuel).toFixed(2));

    return {
      ok: true,
      data: {
        period: {
          startDate,
          endDate
        },
        totals: {
          service: totalService,
          fuel: totalFuel,
          total: grandTotal
        },
        vehicles: summaries
      },
      error: null
    };
  } catch (error) {
    console.error("Get all vehicles costs summary error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "GET_ALL_VEHICLES_COSTS_SUMMARY_ERROR"
      }
    };
  }
}