---
impacto: exige_acao
secao: alterado
titulo: Reagendar muda o próprio compromisso: sem duplicar e sem contar como falta
---

Reagendar um compromisso agora muda o horário do próprio compromisso, em vez de criar outro e marcar o
antigo como "não compareceu". Ele não conta mais como no-show e passa a mostrar o status automático
"Reagendado" até alguém escolher outra situação. O cancelado também pode ser reaberto escolhendo uma
situação no seletor de status.

## Requer atenção

Esta versão inclui uma migration (coluna `calendar_appointments.rescheduled_at` e ajuste da função
`fn_appointment_change_core`). Atualize o banco com o `update.sh`. Compromissos que já tinham sido
duplicados por um reagendamento anterior continuam como estão: o antigo segue como "não compareceu",
mostrado como "Reagendado".
