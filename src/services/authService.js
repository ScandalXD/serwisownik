import { auth, db } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
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
    validatePassword(password);

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