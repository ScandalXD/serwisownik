import { getMyNotifications, markNotificationAsRead, generateReminderNotifications } from '../services/notificationService.js';
import { el, clear } from '../domHelpers.js';
import { showView } from '../uiUtils.js';

// Sprawdzanie nowych powiadomień i aktualizacja licznika
export async function checkNotifications() {
  await generateReminderNotifications();
  
  // Pobieranie nieprzeczytanych powiadomień
  const res = await getMyNotifications({ onlyUnread: true });
  const badge = document.getElementById('notif-badge');
  
  if (res.ok && res.data.length > 0) {
    badge.innerText = res.data.length;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// Ładowanie listy powiadomień
export function initNotificationHandlers() {
  document.getElementById('btn-notifications').onclick = async () => {
    showView('view-notifications');
    const list = document.getElementById('notifications-list');
    clear(list);
    
    const res = await getMyNotifications({ onlyUnread: true });
    
    if (res.ok && res.data.length > 0) {
      res.data.forEach(n => {
        const li = el('li', { className: 'card' }, [
          
          el('span', { className: 'notif-vehicle-tag' }, [n.vehicleName || "Pojazd"]),
          
          el('h3', { className: 'notif-title' }, [n.title]),
          el('p', { className: 'notif-message' }, [n.message]),
          
          el('button', { 
            className: 'small primary notif-read-btn',
            onclick: async (e) => {               
              e.stopPropagation();
              await markNotificationAsRead(n.id);            
              li.remove();              
              checkNotifications();
            }
          }, ['Oznacz jako przeczytane'])
        ]);
        
        list.appendChild(li);
      });
    } else {      
      list.appendChild(el('p', { className: 'empty-state' }, ['Brak nowych powiadomień.']));
    }
  };
}
