---
impacto: exige_acao
secao: alterado
titulo: Reagendar vira anotação "reagendado N vezes"; cancelado fica travado
---

Não existe mais o status "Reagendado". Os status são sempre os seis: Não confirmado, Confirmado,
Compareceu e Comprou, Compareceu e Não comprou, Não compareceu e Cancelado. Ao reagendar, o mesmo
compromisso muda de horário e volta para "Confirmado"; a Página do compromisso mostra uma notinha
embaixo do status ("Reagendado uma vez", "duas vezes", "N vezes"). O contador fica guardado no
compromisso, para medir depois reagendamentos por período, quantos viram cancelamento e quantos se realizam.

Um compromisso cancelado não pode mais ser reaberto: para retomar, crie um novo compromisso, mesmo no
mesmo horário.

## Requer atenção

Esta versão inclui uma migration (coluna `calendar_appointments.reschedule_count` e ajuste de
`fn_appointment_change_core`). Atualize o banco com o `update.sh`. Compromissos já reagendados passam a
contar 1 reagendamento.
