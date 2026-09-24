import { supabase } from '../supabaseClient'

// Chave pública VAPID (par da VAPID_PRIVATE_KEY configurada na Edge Function
// send-push-notifications). Sem ela, o push fica desativado e o app segue
// usando só os alertas dentro do app.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function suportaPush() {
  return Boolean(VAPID_PUBLIC_KEY) &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

function base64UrlParaUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(base64)
  return Uint8Array.from([...bruto].map(c => c.charCodeAt(0)))
}

/**
 * Inscreve este navegador para receber push e salva a inscrição em
 * push_subscriptions. Só age se o usuário já deu permissão de notificação e
 * não desligou "Notificações" em Configurações. Nunca lança erro.
 */
export async function registrarPushSeAutorizado() {
  try {
    if (!suportaPush()) return
    if (Notification.permission !== 'granted') return
    if (localStorage.getItem('pref_notif') === 'false') return

    const registro = await navigator.serviceWorker.ready
    const inscricao = await registro.pushManager.getSubscription() ||
      await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlParaUint8Array(VAPID_PUBLIC_KEY),
      })

    const { keys } = inscricao.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint: inscricao.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'endpoint' })
    if (error) console.warn('Não foi possível salvar a inscrição de push:', error.message)
  } catch (err) {
    console.warn('Push indisponível neste navegador:', err)
  }
}

/** Cancela o push deste navegador (ao desligar "Notificações"). Nunca lança erro. */
export async function desregistrarPush() {
  try {
    if (!('serviceWorker' in navigator)) return
    const registro = await navigator.serviceWorker.ready
    const inscricao = await registro.pushManager.getSubscription()
    if (!inscricao) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', inscricao.endpoint)
    await inscricao.unsubscribe()
  } catch (err) {
    console.warn('Não foi possível cancelar o push:', err)
  }
}
