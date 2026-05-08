# Serwisownik – Backend (Firebase)

## Co trzeba zainstalować

Najpierw zainstaluj Node.js oraz npm.

Potem w folderze projektu uruchom:

```bash
npm install
npm install firebase
npm install dotenv

## Co trzeba przygotować

W głównym folderze projektu utwórz plik .env.

W pliku .env wklej dane konfiguracyjne Firebase:

FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...

## Co trzeba włączyć w Firebase

W Firebase Console trzeba włączyć:

- Authentication (Email/Password)
- Firestore Database
- Storage


