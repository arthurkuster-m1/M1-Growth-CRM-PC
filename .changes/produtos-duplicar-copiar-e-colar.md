---
impacto: capacidade_nova
secao: adicionado
titulo: Produtos: duplicar, copiar para outros clientes, copiar como texto e colar direto na tabela
---

Na tabela de Produtos, ao marcar um ou vários produtos, a barra de seleção ganhou **Duplicar** (cria
"Nome (cópia)" no mesmo cliente; Ctrl+Z apaga as cópias), **Copiar para cliente** (leva os produtos
marcados para um ou vários clientes de uma vez; quem já tem um produto com o mesmo nome o mantém, e
o repetido é pulado) e **Copiar como texto** (copia os produtos como texto de planilha, que cola em
outra planilha ou na tabela de importar de outro cliente).

A importação de produtos agora é uma tabela onde se cola direto da planilha (Ctrl+V), como no app
Finanças: cada linha mostra na hora a situação (pronta, com aviso, com erro, já existe ou repetida),
com os totais embaixo e as linhas com erro ficando para corrigir. Também aceita CSV e o botão
"Colar da planilha".

Corrigido: "Copiar a página como texto" numa página de produto saía vazio. O produto agora tem forma
em texto (`::: oferta`), que também é lida de volta em "Importar de texto".
