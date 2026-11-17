# Prova — excluir e restaurar cliente como usuário logado (migration 0696)

## O que é
Execução do caminho completo **como `authenticated`** (JWT do agente), num Postgres 16 descartável com o
`supabase/baseline.sql` aplicado (prelude do `scripts/test-db.sh`):

| Arquivo | Banco | Resultado |
|---|---|---|
| `antes.txt` | baseline **sem** a 0696 (estado da `main`) | `permission denied for function fn_historico_apagar_do_contato` ao apagar 1 e ao apagar vários; a Lixeira fica vazia; nada é excluído |
| `depois.txt` | baseline **com** a 0696 | apagar 1 ✔, apagar vários em lote ✔, aparecem na Lixeira ✔, restaurar ✔ (clientes, leads, tarefas, conversas, mensagens e histórico voltam); viewer, outra empresa e sem login recebem 42501; as 3 internas seguem sem EXECUTE para `authenticated` e `anon` |

`prova.sql` é o roteiro (rodar com `psql -d <banco> -f prova.sql`).

## O que NÃO é
Não é a prova **pela tela**. Este ambiente não tem a pilha do Supabase (PostgREST + login) nem Docker, então não
dá para abrir `/app/clientes` e `/app/lixeira` num navegador contra um banco. Os testes de rota
(`tests/unit/contato-delete.test.ts`) e a invariante nova (`pnpm test:db`) cobrem o resto; a prova pela tela fica
para depois de aplicar a migration na VPS — roteiro curto:

1. `/app/clientes` → apagar 1 cliente → some da lista, aparece em `/app/lixeira`.
2. Selecionar 2–3 clientes → Excluir em lote → somem, aparecem na Lixeira.
3. Lixeira → Restaurar → voltam com leads, tarefas, conversas e mensagens.
4. Entrar como visualizador: o botão de excluir não deve funcionar (42501 → mensagem de permissão).
