# Prompt para colar na sessão do outro projeto

Copie tudo abaixo da linha.

---

Quero replicar neste projeto o módulo **Anotações** (um bloco de notas estilo Notion, com páginas e subpáginas,
editor de blocos, busca, favoritos, recentes e Caixa de entrada) que já está pronto e funcionando em outro
projeto meu.

**Fonte de referência (somente leitura):** repositório `arthurkuster-m1/M1-Growth-CRM-PC`, branch `main`.
Se ele não estiver neste ambiente, adicione-o só para leitura. Comece lendo `docs/HANDOFF-ANOTACOES.md`: ele tem a
arquitetura, as decisões de desenho, o mapa de arquivos, o que o código assume do projeto de origem, as regras de
segurança e as armadilhas. Os commits de referência estão listados lá (`git show <hash> --stat`).

**Como trabalhar**
1. Leia primeiro o `CLAUDE.md`/convenções **deste** projeto e o handoff. As convenções deste projeto mandam: se
   algo do handoff conflitar (permissões, auditoria, nomes de tabela, migrations, menu, textos), siga este
   projeto e me avise do que mudou.
2. Antes de escrever código, me devolva um **plano curto** com: o que existe aqui que equivale ao que o handoff
   assume (multi-tenant/RLS, papéis, rotas protegidas, auditoria, upload de imagem, menu, shadcn), o que falta
   criar, e o que você pretende adaptar. Espere meu "ok".
3. Depois do ok, siga a ordem sugerida no handoff (seção 7), **uma etapa por vez**, rodando typecheck, lint e testes
   a cada etapa. Os testes de `tests/unit/anotacoes-*` do projeto de origem servem de base.
4. Mantenha as decisões do handoff: editor **BlockNote** (sem pacotes `@blocknote/xl-*`), documento guardado como o
   editor entrega, subpáginas como cartões no corpo da página, visibilidade por página protegida **pela RLS**, busca
   sem acento mantida pela rota, estado por pessoa só do próprio usuário.
5. **Banco:** crie as migrations e o SQL, mas **não aplique** em nenhum banco sem me pedir. Nunca toque no banco de
   outro projeto. Função nova em `public` leva `revoke execute ... from public, anon`.
6. Não copie arquivos às cegas: adapte imports, papéis e componentes de interface ao que existe aqui. Onde o
   handoff cita o upload de imagem do projeto de origem, use o upload daqui ou me pergunte se devo tirar o bloco de
   imagem.
7. Eu não sou programador: explique em português simples, um passo de cada vez, e diga claramente o que foi testado
   e o que não foi.

Comece pelo passo 2 (o plano).
