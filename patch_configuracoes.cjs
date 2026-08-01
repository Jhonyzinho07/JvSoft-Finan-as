const fs = require('fs');
let content = fs.readFileSync('src/pages/Configuracoes.jsx', 'utf8');

// Adiciona o supabase na importação se não existir
if (!content.includes("import { supabase } from '../supabaseClient'")) {
    content = content.replace("import { useToast } from '../components/Toast'", "import { useToast } from '../components/Toast'\nimport { supabase } from '../supabaseClient'");
}

// Utilitário para conversão de Base64
const util = `
// Função para converter chave VAPID base64 para Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
`;

content = content.replace("export default function Configuracoes({ usuario, signOut }) {", util + "\nexport default function Configuracoes({ usuario, signOut }) {");

const handleToggleNotificacoesNova = `
  const inscreverPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!publicVapidKey) {
          console.error("VITE_VAPID_PUBLIC_KEY não configurada no .env");
          return;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }

      // Salvar no Supabase
      const subJson = subscription.toJSON();

      await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: usuario.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth
        }, { onConflict: 'endpoint' });

    } catch (error) {
      console.error('Erro ao inscrever push:', error);
    }
  }

  const handleToggleNotificacoes = async (novoValor) => {
    setNotificacoes(novoValor)
    localStorage.setItem('pref_notif', novoValor)

    if (!('Notification' in window)) {
      toast.warning('Seu navegador não suporta notificações.')
      return
    }

    if (novoValor) {
      if (Notification.permission === 'default') {
        const permissao = await Notification.requestPermission()
        setPermissaoNotif(permissao)
        if (permissao === 'granted') {
          toast.success('Notificações ativadas!')
          await inscreverPush()
        } else {
          setNotificacoes(false)
          localStorage.setItem('pref_notif', false)
        }
      } else if (Notification.permission === 'denied') {
        toast.warning('As notificações estão bloqueadas nas permissões do navegador.')
        setNotificacoes(false)
        localStorage.setItem('pref_notif', false)
      } else if (Notification.permission === 'granted') {
        await inscreverPush()
      }
    }
  }
`;

content = content.replace(/const handleToggleNotificacoes = async \(novoValor\) => {[\s\S]*?localStorage\.setItem\('pref_notif', novoValor\)\n  }/, handleToggleNotificacoesNova);

fs.writeFileSync('src/pages/Configuracoes.jsx', content);
