import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Główna konfiguracja narzędzia budującego (Vite)
export default defineConfig({
  plugins: [
    
    // Konfiguracja wtyczki
    VitePWA({
      
      // Automatycznie pobiera i instaluje nową wersję aplikacji
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg','icon-192.png', 'icon-512.png'], 
      
      // Ustawienia wyglądu po zainstalowaniu na ekranie głównym
      manifest: {
        name: 'Serwisownik',
        short_name: 'Serwisownik',
        description: 'Zarządzanie pojazdami i serwisem',
        theme_color: '#1d4ed8',
        background_color: '#f4f8ff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
        ]
      }
    })
  ]
});