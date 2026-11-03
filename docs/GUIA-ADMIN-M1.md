# Guia das telas do Admin (`/admin`) — para o Arthur

Criado em 03/11/2026. O **Admin** é a área de quem **administra a instalação** (você e sua equipe, os "Super Adm"): ela enxerga **todas as
empresas ao mesmo tempo**. O cliente (Adm ou Membro) **nunca** vê isto. Legenda de prioridade para o MVP:
**🟢 usar no dia a dia** · **🟡 configurar uma vez** · **⚪ consultar quando precisar** · **⚫ pode ignorar por enquanto**.

> Este guia foi feito lendo o código de cada tela. Se algo não bater com o que você vê, me diga que eu corrijo o guia ou a tela.

## O que você vai usar de verdade na operação

| Tela | Para que serve | Prioridade | Quando você usa |
| --- | --- | --- | --- |
| **Tenants** (empresas) | A **lista de todas as empresas** (seus clientes). Busca, filtra por situação (ativa, suspensa, em onboarding), abre a ficha de cada uma. **"Nova empresa"** cria a empresa **e** o convite do dono. | 🟢 | Toda vez que fecha um cliente novo; para suspender ou consultar uma empresa |
| **Usuários** | Todas as **pessoas** de todas as empresas, com busca por nome/e-mail e filtro por empresa. | 🟢 | Achar alguém, ver a qual empresa pertence, resolver "não consigo entrar" |
| **Dashboard** | Visão **geral de todas as empresas** (atualiza a cada 30 s): quantas empresas, atividade, sinais de problema. | ⚪ | Olhar de relance se está tudo vivo |
| **Uso & Custo** | **Consumo** de mensagens, conversas e IA **por empresa** (7, 30 ou 90 dias). | ⚪ | Quando houver cobrança por uso ou para ver quem mais usa; sobe de importância no go-live |
| **Auditoria** (Audit Log) | O **rastro** de tudo que foi mudado no sistema: quem fez, o quê, quando. Só leitura. | ⚪ | Investigar "quem mexeu nisso?" |
| **Incidentes** | Problemas **graves registrados** pelo sistema (com severidade), por empresa. | ⚪ | Quando algo quebrar; no MVP deve ficar vazio |

## O que você configura uma vez (e deixa quieto)

| Tela | Para que serve | Prioridade | Observação para o MVP |
| --- | --- | --- | --- |
| **Configuração** | Painel de **checagem da instalação**: mostra o que está configurado e o que falta, com **E-mail em primeiro lugar** (sem ele não sai convite nem recuperação de senha). | 🟡 | **Comece por aqui** para ver o que falta |
| **E-mail** | Cadastra o **servidor SMTP** que manda os e-mails do produto: **convite de equipe**, entrega de exportação de LGPD e alarmes. Vale para todas as empresas da instalação. | 🟡 | **Importante:** sem isto o convite não sai (hoje você copia o link). Configurar antes do primeiro cliente |
| **Google** | Cadastra o **app OAuth do Google** (Google Cloud) para a **Agenda** de todas as empresas. | 🟡 | Já foi feito; lembrar que o app está em modo teste até o Google verificar |
| **Meta** | Cadastra o **App da Meta** (API Oficial do WhatsApp): a chave que confere cada entrega do webhook e o token de verificação. | 🟡 | Só se for usar a **API oficial** do WhatsApp; senão ignore |
| **Marca** | **White-label da instalação**: nome, logo, cor e ícone que aparecem para todos. | 🟡 | A cor **#366D6F** e o nome da M1 já estão aplicados; revisar o logo |
| **Cadastro** | Decide se **qualquer pessoa pode criar conta** (aberto) ou **só por convite** (ou com aprovação). | 🟡 | **Hoje o padrão é "aberto".** Recomendo **"só por convite"** antes de colocar na internet: evita estranhos criando empresa |
| **Sistema** (Recursos opcionais) | Mostra e liga **recursos que dependem do servidor** (por exemplo, partes opcionais do produto). A voz da tela é "configurado", não "ligado". | ⚪ | Só consultar |

## O que é de governança e segurança (consultar, não mexer sem saber)

| Tela | Para que serve | Prioridade | Observação |
| --- | --- | --- | --- |
| **Platform Admins** | Quem tem **poder de Super Adm** (acesso a todas as empresas). Dá e tira esse poder. | ⚪ | **Aqui entra a sua equipe** quando você contratar alguém para a agência |
| **LGPD** | Pedidos de **titulares de dados** de todas as empresas: exportar dados ou **anonimizar** uma pessoa, com prazos. | ⚪ | Só quando alguém pedir; o sistema já registra prazos (7 e 15 dias) |
| **Inbox** (do admin) | Ver **conversas de qualquer empresa** para suporte (modo acompanhamento). | ⚪ | Use com cuidado: é dado de cliente; fica registrado na auditoria |
| **Destinos internos** | Autoriza endereços da **rede interna** (por exemplo, um modelo de IA rodando na sua própria máquina). | ⚫ | Só interessa para IA local; ignorar |

## O que pode ignorar no MVP

| Tela | Para que serve | Por que ignorar |
| --- | --- | --- |
| **Módulos** | Instala **módulos opcionais com tabela própria** na instalação (por exemplo, CRM B2B). | O MVP não usa módulos; entra na frente "módulos por nicho" |
| **Extensões** | Mostra o **catálogo de extensões** que o servidor conhece e quem as usa. Só leitura. | Sem extensões no MVP |

## Fluxos que você vai fazer (passo a passo, em linguagem simples)

**Criar uma empresa nova (cliente fechado)**
1. Admin › **Tenants** › **Nova empresa**. Preencha o nome, o identificador (slug) e o e-mail do **dono** da empresa.
2. A tela mostra o **link do convite do dono** (vale 24 h) com o botão **Copiar convite**. Se o e-mail estiver configurado, ele também é enviado.
3. O dono abre o link, entra (Google ou e-mail e senha com o mesmo e-mail do convite) e cai **na empresa dele**, como Adm.
4. Dentro da empresa, em **Equipe**, o dono (ou você) convida os funcionários.
5. No **Modo agência**, a empresa aparece no seletor de clientes (dá para escolher a cor).

**Dar acesso a alguém da sua equipe em todas as empresas:** Admin › **Platform Admins** (poder total). Para acesso só a alguns clientes, convide a pessoa
como gerente ou admin **em cada empresa** (é o que o Modo agência usa).

**O convite não chegou:** Admin › **E-mail** (configurar) ou, em **Equipe**, usar **Copiar link** e mandar pelo WhatsApp. O link vale 24 h; dá para **Reenviar**.

**Suspender um cliente (parou de pagar):** Admin › **Tenants** › abrir a empresa › suspender. Ninguém dessa empresa consegue entrar até reativar; os dados ficam.

## Para o MVP, a ordem sugerida de configuração
1. **Configuração** (ver o que falta) → 2. **E-mail** → 3. **Cadastro: só por convite** → 4. **Marca** (conferir) → 5. **Google** (verificação) → 6. **Meta** (só se for usar a API oficial).

## O que eu sugiro mudar no Admin depois (frente 14 — multi-tenant)
Você disse que **não é prioridade editar nada por lá agora**. Fica só a lista para o futuro:
- Mostrar, na lista de **Tenants**, as métricas que você usa para **acompanhar clientes** (atividade, leads do mês, última entrada).
- Um **atalho "Entrar como o cliente"** (modo acompanhamento) direto na ficha da empresa.
- Juntar **Uso & Custo** com cobrança, quando você for cobrar por uso.
- Textos do Admin ainda misturam inglês ("Tenants", "Audit Log", "cross-tenant"): trocar por "Empresas", "Auditoria" etc.
