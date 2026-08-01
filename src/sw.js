import { precacheAndRoute } from 'workbox-precaching';

// Precaching automático de assets estáticos pelo Vite
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listener para Push Notifications (Backend -> Browser)
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Nova Notificação';
      const options = {
        body: data.body || 'Você tem novas atualizações.',
        icon: data.icon || '/logo.png',
        data: data.data || { url: '/' },
      };

      event.waitUntil(
        self.registration.showNotification(title, options)
      );
    } catch(e) {
      // Se não for JSON
      event.waitUntil(
        self.registration.showNotification('JvSoft Finanças', {
          body: event.data.text(),
          icon: '/logo.png'
        })
      );
    }
  }
});

// Listener para clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já tiver uma janela aberta do app, foca nela
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão, abre uma nova
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
