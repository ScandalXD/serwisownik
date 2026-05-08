import { auth, db } from "../firebase.js";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  deleteDoc 
} from "firebase/firestore";
import { AppError } from "../errors.js";

function requireAuth() {
  const user = auth.currentUser;
  if (!user) throw new AppError("Użytkownik nie jest zalogowany", "AUTH_REQUIRED");
  return user;
}

export async function getVehicles() {
  try {
    const user = requireAuth();
    const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
    const snapshot = await getDocs(q);
    return {
      ok: true,
      data: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
      error: null
    };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message } };
  }
}

export async function addVehicle(vehicleData) {
  try {
    const user = requireAuth();
    const docRef = await addDoc(collection(db, "vehicles"), {
      userId: user.uid,
      brand: vehicleData.brand,
      model: vehicleData.model,
      year: Number(vehicleData.year),
      currentMileage: Number(vehicleData.currentMileage),
      createdAt: new Date()
    });
    return { ok: true, data: { id: docRef.id, ...vehicleData }, error: null };
  } catch (error) {
    return { ok: false, data: null, error: { message: error.message } };
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