import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook customizado para escutar mudanças no Realtime do Supabase.
 * @param {string[]} tables - Array com o nome das tabelas para escutar (ex: ['transacoes', 'contas']).
 * @param {function} callback - Função que será chamada quando ocorrer um evento de mudança.
 */
export function useRealtime(tables, callback) {
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!tables || tables.length === 0) return;

    // Criar um nome único para o canal unindo os nomes das tabelas
    const channelName = `realtime-${tables.join('-')}`;
    const channel = supabase.channel(channelName);

    // Inscrever-se para cada tabela solicitada
    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          console.log(`[Realtime] Mudança detectada em ${table}:`, payload);
          if (savedCallback.current) {
            savedCallback.current(payload);
          }
        }
      );
    });

    // Iniciar a inscrição
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Inscrito no canal: ${channelName}`);
      }
    });

    // Função de limpeza ao desmontar o componente
    return () => {
      supabase.removeChannel(channel);
      console.log(`[Realtime] Inscrição removida: ${channelName}`);
    };
  }, [JSON.stringify(tables)]);
}
