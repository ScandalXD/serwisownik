// Tworzenie własnego typu błędu dla aplikacji
export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

// Logowanie i wyświetlanie błędu użytkownikowi
export function handleError(error) {
  console.error(`[${error.code || 'ERROR'}]: ${error.message}`);
  alert(error.message);
}