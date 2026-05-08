# Serwisownik 

**Serwisownik** to aplikacja webowa typu **PWA (Progressive Web App)**, stworzona dla kierowców, którzy chcą mieć pełną kontrolę nad swoimi pojazdami. Pozwala na śledzenie wydatków na paliwo, historię napraw, zarządzanie przypomnieniami oraz przechowywanie dokumentacji (zdjęcia paragonów/faktur) w chmurze.



## Główne funkcje

* **Garaż:** zarządzanie wieloma pojazdami w jednym miejscu.
* **Dziennik Tankowań:** automatyczne obliczanie średniego spalania (l/100km).
* **Historia Serwisowa:** ewidencja napraw i wymian części wraz z kosztami.
* **Inteligentne Przypomnienia:** alerty o zbliżającym się przeglądzie, ubezpieczeniu lub wymianie oleju.
* **Załączniki:** Możliwość przesyłania i przeglądania załączników.
* **Tryb PWA:** Możliwość instalacji aplikacji na telefonie i komputerze oraz praca w trybie offline (częściowa).

## Technologie

* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3.
* **Narzędzia:** [Vite](https://vitejs.dev/) – bundler i serwer deweloperski.
* **Backend:** [Firebase](https://firebase.google.com/) (Auth, Firestore, Storage).
* **PWA:** [Vite PWA Plugin](https://vite-pwa-org.netlify.app/) – obsługa Service Workera i manifestu.

---

## Instalacja i konfiguracja

Podążaj za poniższymi krokami, aby uruchomić projekt lokalnie na swoim komputerze.

### 1. Wymagania wstępne
Upewnij się, że masz zainstalowane:
* [Node.js](https://nodejs.org/) (zalecana wersja LTS).
* Konto na platformie [Firebase](https://console.firebase.google.com/).

### 2. Pobieranie projektu
```bash

git clone [https://github.com/ScandalXD/serwisownik.git](https://github.com/ScandalXD/serwisownik.git)
cd serwisownik
```

### 3. Instalacja zależności

Wszystkie niezbędne biblioteki (Vite, Firebase, wtyczki PWA) zostaną zainstalowane za pomocą jednej komendy:

```bash
npm install
```

### 4. Konfiguracja zmiennych środowiskowych

W głównym folderze projektu utwórz plik .env i wklej do niego swoje dane z panelu Firebase (Project Settings > Apps > Web App):
Fragment kodu

```bash
VITE_FIREBASE_API_KEY=twoj_klucz
VITE_FIREBASE_AUTH_DOMAIN=twoja_domena.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=id_projektu
VITE_FIREBASE_STORAGE_BUCKET=id_projektu.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=sender_id
VITE_FIREBASE_APP_ID=app_id

```
    Uwaga: Przedrostek VITE_ jest niezbędny, aby narzędzie Vite mogło poprawnie zaimportować te zmienne do kodu aplikacji.

### 5. Konfiguracja Firebase Console

Aby aplikacja działała poprawnie, włącz w swoim projekcie Firebase:

    Authentication: Włącz metodę logowania E-mail/Hasło.

    Firestore Database: Stwórz bazę danych w trybie produkcyjnym lub testowym.

    Storage: Włącz przestrzeń na pliki, aby umożliwić przesyłanie zdjęć dokumentów.

### 6. Uruchamianie aplikacji
Tryb deweloperski

Aby uruchomić serwer lokalny z podglądem na żywo:

```bash
npm run dev
```

Aplikacja będzie dostępna pod adresem: http://localhost:5173

### 7. Budowanie wersji produkcyjnej

Aby wygenerować zoptymalizowane pliki gotowe do wrzucenia na hosting:
```bash
npm run build
```

Gotowe pliki znajdą się w folderze /dist.
### 8. Instalacja jako aplikacja (PWA)

Serwisownik wykorzystuje technologię Progressive Web App, co oznacza, że możesz go zainstalować jak zwykłą aplikację:

    Na Android/Chrome: Kliknij ikonę trzech kropek i wybierz "Zainstaluj aplikację" lub "Dodaj do ekranu głównego".

    Na iOS/Safari: Kliknij ikonę udostępniania (kwadrat ze strzałką) i wybierz "Do ekranu początkowego".

    Na komputerze: Kliknij ikonę komputera z plusikiem w pasku adresu przeglądarki.

