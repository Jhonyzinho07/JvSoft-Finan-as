import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook customizado para escutar mudanças no Realtime do Supabase.
 * O RLS vale para o Realtime: cada usuário só recebe eventos das próprias linhas.
 * @param {string[]} tables - Array com o nome das tabelas para escutar (ex: ['transacoes', 'contas']).
 * @param {function} callback - Função que será chamada quando ocorrer um evento de mudança.
 */
export function useRealtime(tables, callback) {
  const savedCallback = useRef();
  const tablesKey = (tables || []).join(',');

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!tablesKey) return;

    // Nome único por instância: duas telas escutando as mesmas tabelas
    // não podem compartilhar o mesmo canal.
    const channel = supabase.channel(`realtime-${tablesKey}-${crypto.randomUUID()}`);

    tablesKey.split(',').forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => savedCallback.current?.(payload)
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tablesKey]);
}
