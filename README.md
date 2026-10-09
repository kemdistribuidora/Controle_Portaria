# Controle de Portaria

Tela simples e travada para a portaria registrar a **movimentação da frota** e o **controle de
acesso** (clientes, fornecedores e visitas), no lugar de preencher as folhas de papel ou o
Google Sheets direto.

Mesmo modelo do **Grid de Operação**: o porteiro nunca abre a planilha. Abre um link fixo
(GitHub Pages), escolhe o grid, digita e clica em Salvar. Quem escreve na planilha é o Apps
Script, sempre no formato certo.

**2 grids, um por vez** (barra de cima):

| Grid | Aba na planilha | O que registra |
|---|---|---|
| `Movimentação Frota` | **Movimentação Frota** | Caminhões 16–38 (com placa): hora, KM e °C de saída e de retorno + observação |
| `Controle Acesso` | **Controle Acesso** | Cliente (nome fantasia + nota), Fornecedor, Visita (nome + empresa): chegada, saída, placa, assunto/contato |

Salvar grava **só o grid aberto, na data escolhida**. A outra aba e os outros dias ficam
intactos. A data abre no **dia de hoje** (a portaria lança em tempo real). A tela lembra o
último grid usado (por PC).

Planilha: <https://docs.google.com/spreadsheets/d/1Bt4SwNhG_eDvclhRsyGIQnbfTMB84ZLsE9N_77frFZM/edit>
(mesma planilha dos dados da operação — as abas novas são criadas pelo script).

## Como as peças se encaixam

```
  Porteiro
     │  abre o link fixo
     ▼
  GitHub Pages  ──────────►  index.html (a tela)
     │                          │ JSONP (carregar / salvar)
     │                          ▼
     │                    Apps Script /exec  (a API, roda como VOCÊ)
     │                          │
     │                          ▼
     └────────────────►  abas "Movimentação Frota" e "Controle Acesso"
```

## As abas (formato de lista, uma linha por lançamento)

**Movimentação Frota**

`Data · Frota · Placa · Hora saída · KM saída · °C saída · Hora retorno · KM retorno · °C retorno · KM rodado · Observação · Atualizado em`

- **KM rodado** é calculado pelo script = KM retorno − KM saída.
- **°C** só se o veículo estiver carregado. Aceita negativo e uma casa (`-18,5`).
- Caminhão sem movimento no dia **não gera linha**.

**Controle Acesso**

`Data · Tipo · Nome · Empresa / Nome fantasia · Nota fiscal · Placa · Chegada · Saída · Permanência · Observação · Atualizado em`

- **Tipo** = Cliente / Fornecedor / Visita. **Permanência** é calculada = Saída − Chegada.
- **Nota fiscal** só para Cliente (aceita várias: `123, 124`).

## Na tela

- **Frota:** obrigatório Hora + KM de saída. Começou o retorno → Hora + KM de retorno.
  KM de retorno menor que o de saída fica em vermelho.
- **Acesso:** botões `+ Cliente`, `+ Fornecedor`, `+ Visita` criam a linha já com a hora de
  chegada de agora. Obrigatório: Cliente → nome fantasia + nota; Fornecedor → fornecedor;
  Visita → nome + empresa. `✕` remove a linha.
- **Dois cliques** num campo de hora vazio preenchem com a hora atual. **Enter** passa de campo.
- Faixa **laranja** = em aberto (caminhão na rua / pessoa no local). Preencha o retorno/saída
  depois e salve de novo — regravar o dia substitui, nunca duplica.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | A tela (servida pelo GitHub Pages) |
| `apps-script/Codigo.gs` | A API: lê e grava nas duas abas (fora do repo remoto, como no Grid) |
| `imagens/` | Logo e ícone. **Precisa ir no push** |
| `.github/workflows/pages.yml` | Publica o Pages a cada push |
| `tests/` | Testes do `Codigo.gs` (`npm test`) |

## Ver o visual agora

Abra `index.html` no navegador. Sem `API_URL`, roda em **MODO PREVIEW** (aviso amarelo):
dá para testar tudo, nada é gravado.

## Publicar — passo a passo

### Parte A — a API (Apps Script)

1. Abra a planilha → **Extensões → Apps Script**
2. Cole o conteúdo de `apps-script/Codigo.gs` no `Codigo.gs`
   (se a planilha já tem o script do Grid de Operação, crie um **projeto separado** em
   script.google.com — o `PLANILHA_ID` já aponta para a planilha certa)
3. Confira o **`PLANILHA_ID`** no `CONFIG`
4. Rode **`prepararAbas`** uma vez (aceite a autorização). Cria as duas abas formatadas.
   Seguro rodar de novo.
5. **Implantar → Nova implantação → App da Web** — Executar como: **eu** · Acesso: **qualquer pessoa**
6. Copie o link que termina em **`/exec`** e teste: `.../exec?acao=ping` deve responder
   `{"ok":true,"dados":"pong",...}`

### Parte B — a tela (GitHub Pages)

1. Cole o link `/exec` em `var API_URL = '...'` no começo do `<script>` do `index.html`
2. Commit e push na `main`
3. GitHub: **Settings → Pages → Source: GitHub Actions** (uma vez só)
4. Link fixo: **https://kemdistribuidora.github.io/Controle_Portaria/**

> Ao mudar o `Codigo.gs`: **Implantar → Gerenciar implantações → editar → Nova versão**
> (mantém a mesma URL `/exec`). Ao mudar o `index.html`, basta o push.

Problemas (login do Google no ping, CORS, página em branco): mesma tabela do README do
Grid de Operação — quase sempre é implantação antiga ou acesso diferente de "Qualquer pessoa".

## Ajustes comuns

No `CONFIG` do `Codigo.gs` (e republicar como Nova versão):

- **Caminhão novo / placa trocada** → `FROTA` (atualize também a lista do `PreviewBackend` no `index.html`)
- **Novo tipo de acesso** → `TIPOS` (`id`, `nome`, `cor`). O `id` não deve mudar depois de haver dados.
