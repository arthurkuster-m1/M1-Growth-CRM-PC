---
impacto: exige_acao
secao: adicionado
titulo: Tarefas da agência espelhadas entre a agência e o cliente
---

Na ficha do contato (CRM da agência), o super-admin ganha **Organização vinculada**: liga o contato à organização do
cliente. Daí em diante, a tarefa da agência para esse contato nasce também na empresa do cliente (marcada "da agência"
no cronograma), e a tarefa marcada "da agência" na empresa do cliente nasce também na agência, com o contato.
Título, descrição, prazo, início, prioridade e situação ficam iguais dos dois lados; apagar de um lado apaga o outro;
desmarcar "da agência" no cliente remove a cópia da agência.

## Requer atenção

Esta versão inclui a migration 0682 (colunas `contacts.linked_organization_id` e `crm_tasks.mirror_task_id` e os
gatilhos do espelhamento). Atualize o banco com o `update.sh`.
