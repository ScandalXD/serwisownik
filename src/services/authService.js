import { auth, db } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { AppError } from "../errors.js";
import { validateEmail, validatePassword } from "../validators.js";

export async function register(email, password) {
  try {
    validateEmail(email);
    validatePassword(password);

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      createdAt: new Date()
    });

    return {
      ok: true,
      data: user,
      error: null
    };
  } catch (error) {
    console.error("Register error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "REGISTER_ERROR"
      }
    };
  }
}

export async function login(email, password) {
  try {
    validateEmail(email);

    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    return {
      ok: true,
      data: userCredential.user,
      error: null
    };
  } catch (error) {
    console.error("Login error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "LOGIN_ERROR"
      }
    };
  }
}

export async function logout() {
  try {
    await signOut(auth);

    return {
      ok: true,
      data: true,
      error: null
    };
  } catch (error) {
    console.error("Logout error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "LOGOUT_ERROR"
      }
    };
  }
}

export async function getCurrentUserProfile() {
  try {
    const user = auth.currentUser;

    if (!user) {
      throw new AppError("User is not authenticated", "AUTH_REQUIRED");
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return {
        ok: true,
        data: null,
        error: null
      };
    }

    return {
      ok: true,
      data: {
        id: userSnap.id,
        ...userSnap.data()
      },
      error: null
    };
  } catch (error) {
    console.error("Get current user profile error:", error.message);
    return {
      ok: false,
      data: null,
      error: {
        message: error.message,
        code: error.code || "PROFILE_ERROR"
      }
    };
  }
}

// Pobieranie danych konta
export async function exportUserData() {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new AppError("Brak zalogowanego użytkownika", "AUTH_REQUIRED");
    }

    const vehiclesQ = query(collection(db, "vehicles"), where("userId", "==", user.uid));
    const vehiclesSnap = await getDocs(vehiclesQ);
    
    const vehiclesMap = {};
    vehiclesSnap.forEach(doc => {
      const data = doc.data();
      vehiclesMap[doc.id] = `${data.brand || ''} ${data.model || ''}`.trim();
    });

    const fuelQ = query(collection(db, "fuelRecords"), where("userId", "==", user.uid));
    const fuelSnap = await getDocs(fuelQ);

    const serviceQ = query(collection(db, "serviceRecords"), where("userId", "==", user.uid));
    const serviceSnap = await getDocs(serviceQ);

    const remindersQ = query(collection(db, "reminders"), where("userId", "==", user.uid));
    const remindersSnap = await getDocs(remindersQ);

    let csvContent = "\uFEFF"; 
    csvContent += "Typ wpisu;Pojazd;Data;Przebieg (km);Koszt (PLN);Tankowanie (litry);Szczegóły\n";

    vehiclesSnap.forEach(doc => {
      const v = doc.data();
      csvContent += `Garaż;${vehiclesMap[doc.id]};-;${v.mileage || ''};-;-;Rocznik: ${v.year || ''}\n`;
    });

    fuelSnap.forEach(doc => {
      const f = doc.data();
      const vehicleName = vehiclesMap[f.vehicleId] || "Nieznany pojazd";
      csvContent += `Tankowanie;${vehicleName};${f.date || ''};${f.mileage || ''};${f.cost || ''};${f.liters || ''};-\n`;
    });

    serviceSnap.forEach(doc => {
      const s = doc.data();
      const vehicleName = vehiclesMap[s.vehicleId] || "Nieznany pojazd";
      csvContent += `Serwis;${vehicleName};${s.date || ''};${s.mileage || ''};${s.cost || ''};-;${s.description || ''}\n`;
    });

    remindersSnap.forEach(doc => {
      const r = doc.data();
      const vehicleName = vehiclesMap[r.vehicleId] || "Nieznany pojazd";
      csvContent += `Przypomnienie;${vehicleName};${r.date || ''};${r.mileage || ''};-;-;${r.title || ''}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `Serwisownik_Dane_${dateStr}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { ok: true, error: null };
  } catch (error) {
    console.error("Błąd eksportu danych:", error.message);
    return {
      ok: false,
      error: {
        message: error.message,
        code: error.code || "EXPORT_ERROR"
      }
    };
  }
}
