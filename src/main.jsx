import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
// 1. Importar as ferramentas do React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 2. Criar o "banco de dados local" para o cache (mantém os dados vivos por 5 minutos)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos sem precisar ir no Supabase de novo
      refetchOnWindowFocus: false, // Não recarrega só por mudar de aba no navegador
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 3. Envolver a aplicação */}
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)