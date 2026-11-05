---
impacto: nada_mudou
secao: corrigido
titulo: A lista de mensagens não entrega mais o endereço interno do WhatsApp ao navegador
---

O campo `media_url` das mensagens trazia o endereço interno do contêiner do WhatsApp
(`http://localhost:3000/api/files/...`) até o navegador. Agora a API devolve o endereço da própria
rota de mídia do CRM. O banco e o download da mídia não mudaram.
