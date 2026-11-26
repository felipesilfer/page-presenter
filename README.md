# Page Presenter

Transforma o conteúdo de uma página HTML em uma **apresentação de slides em tela cheia**. Feito só com HTML, CSS e JavaScript, sem dependências e sem etapa de build. Funciona abrindo o arquivo direto no navegador (`file://`).

A página continua sendo a fonte do conteúdo. O módulo copia os blocos dela para os slides, sem alterar a página original.

## Sumário

1. [Início rápido](#início-rápido)
2. [Arquivos](#arquivos)
3. [Como os slides são montados](#como-os-slides-são-montados)
4. [Opções de `open()`](#opções-de-open)
5. [Navegação](#navegação)
6. [Recursos para apresentar](#recursos-para-apresentar)
7. [Componentes de slide](#componentes-de-slide)
8. [Personalização](#personalização)
9. [Uso com Tailwind ou Bootstrap](#uso-com-tailwind-ou-bootstrap)
10. [API](#api)
11. [Compatibilidade e limitações](#compatibilidade-e-limitações)
12. [Testes](#testes)

## Início rápido

```html
<link rel="stylesheet" href="page-presenter.css">
<link rel="stylesheet" href="page-presenter-deck.css"> <!-- opcional: visual dos slides -->
<script src="page-presenter.js"></script>

<button id="btn-apresentar">Apresentar</button>

<article id="artigo">
  <p>Introdução: vai para a capa.</p>
  <section><h2>Primeiro tópico</h2><p>Vira um slide.</p></section>
  <section><h2>Segundo tópico</h2><p>Vira outro slide.</p></section>
</article>

<script>
  document.getElementById('btn-apresentar').addEventListener('click', () => {
    PagePresenter.open({ source: '#artigo', title: 'Minha apresentação' });
  });
</script>
```

Chame `open()` a partir de um clique. Sem um gesto do usuário, o navegador recusa a tela cheia, e a apresentação ocupa só a janela.

## Arquivos

| Arquivo | Obrigatório | Conteúdo |
| :---- | :---- | :---- |
| `page-presenter.js` | sim | O módulo. Expõe o objeto global `PagePresenter`. |
| `page-presenter.css` | sim | A moldura: overlay, slide ativo, botão ×, rodapé, progresso, passos e notas. Também define as variáveis `--pp-*`. |
| `page-presenter-deck.css` | não | O tema dos slides: espaçamento entre blocos, capa, fechamento e componentes `.deck-*`. |
| `index.html` | — | Esta documentação, com demonstrações de todos os recursos. |
| `tests/tests.html` | — | Testes: abra no navegador e confira se todas as linhas ficam verdes. |
| `tests/test-tailwind.html`, `tests/test-bootstrap.html` | — | Testes de convivência com Tailwind 4 e Bootstrap 5.3, carregados por CDN (precisam de internet). |

Sem o `page-presenter-deck.css`, a apresentação continua funcionando. Os slides passam a usar só o CSS da sua página ou do seu framework.

## Como os slides são montados

### A partir do conteúdo da página

Com `open({ source: '#artigo' })`, os filhos diretos de `source` são distribuídos assim:

1. **Capa:** a categoria, o título e todo o conteúdo que vem antes da primeira seção.
2. **Seções:** cada filho que corresponde a `sectionSelector` (padrão: `section`) vira um slide.
3. **Conteúdo solto** entre seções entra no slide da seção anterior.
4. **Fechamento:** filhos que correspondem a `closingSelector` viram um slide com visual de fechamento.

Os blocos são copiados sem IDs, para não duplicá-los, e sem `<button>`, que não funcionariam no slide. Elementos com `hidden` continuam ocultos.

### Roteiro próprio

Para escrever os slides à mão, coloque um `.presentation-deck` oculto como filho direto de `source`. Cada `.deck-slide` vira um slide, e o resto do conteúdo é ignorado. `data-variant="cover"` aplica o visual de capa.

```html
<div id="artigo">
  <div class="presentation-deck" hidden>
    <div class="deck-slide" data-variant="cover">
      <h1 class="deck-title">Slide de abertura</h1>
    </div>
    <div class="deck-slide">
      <h2 class="deck-title">Segundo slide</h2>
      <ol class="deck-flow"><li>Etapa 1</li><li>Etapa 2</li></ol>
    </div>
  </div>
  ...conteúdo normal da página...
</div>
```

## Opções de `open()`

| Opção | Padrão | Descrição |
| :---- | :---- | :---- |
| `source` | — | Elemento de origem: seletor, elemento ou função que retorna um deles. |
| `title` | `document.title` | Título da capa: texto ou função. |
| `category` | — | Etiqueta acima do título da capa: texto ou função. |
| `sectionSelector` | `'section'` | Filhos diretos de `source` que viram um slide cada. |
| `closingSelector` | — | Filhos diretos que viram o slide de fechamento. |
| `slideClass` | — | Classes extras no recipiente de cada slide, como `'prose'` (Tailwind) ou `'container'` (Bootstrap). |
| `labels` | textos em português | `{ hint, close, dialog }`: dica do rodapé, rótulo do × e nome do diálogo para leitores de tela. |
| `hash` | `false` | Guarda o slide atual na URL (`#slide-3`). |
| `onChange` | — | `(indice, total) => {}`: chamada sempre que o slide muda. |

`source`, `title` e `category` aceitam funções, avaliadas a cada abertura. Isso é útil quando o conteúdo exibido muda, como em páginas com abas.

`open()` retorna `false` se não houver o que apresentar. Chamado com a apresentação já aberta, troca os slides sem sair da tela cheia.

## Navegação

| Ação | Teclas |
| :---- | :---- |
| Avançar | `→` `↓` `Espaço` `Page Down` |
| Voltar | `←` `↑` `Backspace` `Page Up` |
| Primeiro / último slide | `Home` / `End` |
| Percorrer links e campos do slide | `Tab` / `Shift+Tab` (circula entre o × e os elementos do slide) |
| Abrir as notas do apresentador | `N` |
| Sair | `Esc` ou o botão **×** no canto superior direito |

- **Clique:** na metade direita do slide avança, na metade esquerda volta. Cliques em links, botões e campos não trocam de slide.
- **Toque:** deslize para os lados. Rolar na vertical não troca de slide.
- **Atalhos do navegador:** teclas combinadas com Alt, Ctrl ou Cmd não são capturadas. Enquanto o foco está num campo de texto, as teclas de navegação digitam normalmente.
- **Tamanho:** cada slide é ampliado ou reduzido para caber na tela. Slides muito longos ganham rolagem.

## Recursos para apresentar

### Revelação passo a passo

Elementos com `data-step` começam invisíveis e aparecem um por vez a cada avanço. Depois do último, o próximo avanço troca de slide. Voltar esconde o último passo revelado. Ao voltar para o slide anterior, ele aparece com todos os passos revelados. O espaço dos passos é reservado desde o início, então o slide não muda de tamanho.

```html
<ul>
  <li data-step>primeiro</li>
  <li data-step>segundo</li>
</ul>
```

### Notas do apresentador

Texto dentro de `.deck-notes` nunca aparece na página nem no slide. A tecla `N`, ou `PagePresenter.openNotes()`, abre uma segunda janela com:
- as notas do slide atual;
- a posição e o passo atual;
- o título do próximo slide;
- um cronômetro.

As teclas de navegação também funcionam nessa janela.

Alguns navegadores saem da tela cheia ao abrir uma janela. O módulo ignora essa saída, e a apresentação continua ocupando a janela. Para manter a tela cheia, abra as notas antes de apresentar, por um botão que chame `PagePresenter.openNotes()`. Se o navegador bloquear pop-ups, `openNotes()` retorna `false`.

### Slide na URL

Com `hash: true`, a URL acompanha o slide (`#slide-3`). Se a página for recarregada, a próxima abertura começa no slide indicado. Ao fechar, o fragmento é removido. Em `file://`, ele continua na URL, porque o Chrome não permite reescrevê-la ali.

### Aviso de troca de slide

`onChange(indice, total)` é chamada na abertura e a cada troca de slide. Não é chamada a cada passo. Serve para estatísticas, legendas ou sincronizar outro elemento da página.

## Componentes de slide

Estes componentes ficam em `page-presenter-deck.css`. Funcionam no roteiro próprio e dentro das seções de um artigo.

| Classe | Uso |
| :---- | :---- |
| `.deck-title`, `.deck-subtitle`, `.deck-text` | Título, subtítulo em destaque e texto |
| `.deck-statement` | Frase de destaque com barra lateral |
| `.deck-flow` (`.deck-flow-muted`) | Etapas com setas entre elas |
| `.deck-checklist` | Lista com marcas de ✓ |
| `.deck-products` (`.deck-products-more`) | Etiquetas |
| `.deck-network`, `.deck-network-node`, `.deck-network-arrow` | Dois blocos ligados por seta (variantes `-threat` e `-response`), para fundo escuro |
| `.deck-stats` | Números em destaque: `<li><strong>98%</strong> legenda</li>` |
| `.deck-columns` (`.deck-columns-compare`) | Colunas lado a lado; a variante destaca a última, para "antes × depois" |
| `.deck-cards` | Cartões com ícone (`<svg>`), `<h3>` e `<p>` |
| `.deck-figure` | `<figure>` com imagem, SVG ou vídeo ajustado à tela e `<figcaption>` |
| `.deck-timeline` (`li.deck-timeline-done`) | Linha do tempo vertical com `<time>` em cada marco |
| `.deck-bars` | Barras de percentual: `<li style="--value: 72">Rótulo</li>` (inteiro de 0 a 100) |
| `.deck-quote` | `<blockquote>` com `<p>` e `<cite>` para o autor |
| `.deck-table` (`.deck-num`) | Tabela com cabeçalho destacado; `.deck-num` alinha números à direita |
| `.deck-code` | `<pre class="deck-code"><code>…</code></pre>` |

`.deck-title`, `.deck-text`, `.deck-statement`, `.deck-stats` e `.deck-quote` têm visual próprio sobre a capa. Em telas estreitas, as grades viram uma coluna.

## Personalização

### Variáveis CSS

As cores e medidas são variáveis com prefixo `--pp-`, definidas em `:root` no `page-presenter.css`. Para mudar, redefina-as no seu CSS, carregado depois do módulo:

```css
:root {
  --pp-primary: #6b21a8;
  --pp-primary-deep: #3b0764;
  --pp-accent: #a855f7;
  --pp-highlight: #facc15;
}
```

| Grupo | Variáveis |
| :---- | :---- |
| Fundo e superfícies | `--pp-bg`, `--pp-surface`, `--pp-subtle`, `--pp-border`, `--pp-border-light` |
| Texto | `--pp-text`, `--pp-text-secondary`, `--pp-text-muted`, `--pp-text-inverse` |
| Cores da marca | `--pp-primary`, `--pp-primary-deep`, `--pp-accent`, `--pp-accent-soft`, `--pp-highlight`, `--pp-success` |
| Forma | `--pp-radius-md`, `--pp-radius-lg`, `--pp-radius-full`, `--pp-shadow-md`, `--pp-shadow-lg`, `--pp-transition` |
| Caixa do slide | `--pp-slide-bg`, `--pp-slide-shadow`, `--pp-slide-radius`, `--pp-slide-padding`, `--pp-slide-padding-sm` (telas estreitas), `--pp-slide-max-width` |

As variáveis da caixa do slide também podem ser redefinidas num slide só, porque valem a partir do elemento onde são declaradas.

### Classes no slide

Os slides recebem classes que o seu CSS pode usar:

| Classe | Onde |
| :---- | :---- |
| `.presentation-slide` | Cada slide (ocupa a tela) |
| `.presentation-slide-inner` | Recipiente do conteúdo (a caixa) |
| `.presentation-cover` | Capa, gerada ou `data-variant="cover"` |
| `.presentation-closing` | Slide de fechamento |
| `.presentation-from-deck` | Slides do roteiro próprio |
| `.presentation-category`, `.presentation-cover-title`, `.presentation-cover-body` | Partes da capa gerada |

## Uso com Tailwind ou Bootstrap

O módulo se divide em duas partes:
- **a moldura**, que é função (`page-presenter.css`, obrigatória);
- **o visual dos slides** (`page-presenter-deck.css`, opcional).

Com um framework, o caminho mais simples é carregar só a moldura, montar o conteúdo dos slides com as classes do framework e, se quiser, zerar a caixa branca:

```css
:root {
  --pp-slide-bg: transparent;
  --pp-slide-shadow: none;
  --pp-slide-padding: 0;
  --pp-slide-padding-sm: 0;
}
```

A moldura foi feita para conviver com os resets dos frameworks (Preflight do Tailwind, Reboot do Bootstrap):
- os slides são `<div>`, então regras da página para `section` não vazam para eles;
- o botão × define todas as propriedades que usa;
- a moldura define o próprio `box-sizing`;
- todas as classes e variáveis têm prefixo (`presentation-`, `deck-`, `--pp-`);
- o overlay usa `z-index: 2000`, acima de modais e tooltips do Bootstrap.

### Tailwind

- **Conteúdo dos slides:** as classes do Tailwind usadas no artigo ou nos `.deck-slide` já funcionam no slide. O Tailwind também encontra essas classes, porque estão no HTML da página.
- **Tipografia:** com o plugin Typography, `slideClass: 'prose lg:prose-xl'` dá estilo ao texto clonado.
- **Classes só no JavaScript:** classes que aparecem só no `slideClass` precisam estar em arquivos que o Tailwind lê. O Tailwind 4 lê o projeto inteiro, e o Tailwind do CDN gera o CSS delas logo depois que o slide abre.
- **Cores do tema:** o Tailwind 4 expõe o tema como variáveis CSS, que podem alimentar as do módulo: `:root { --pp-primary: var(--color-indigo-700); }`.
- **Precedência no Tailwind 4:** o Tailwind 4 usa camadas CSS (`@layer`), e CSS fora de camada vence CSS em camada. Para que os utilitários vençam o módulo, importe o módulo numa camada:

  ```css
  @import "tailwindcss";
  @import "./page-presenter.css" layer(components);
  @import "./page-presenter-deck.css" layer(components);
  ```

- **Tailwind 3:** não usa camadas nativas, então quem vence é a ordem dos arquivos. Carregue os CSS do módulo antes do CSS gerado pelo Tailwind.

### Bootstrap

- Carregue os CSS do módulo antes do Bootstrap. Os utilitários do Bootstrap usam `!important` e vencem de qualquer forma.
- Os componentes do Bootstrap (`card`, `table`, `blockquote`, `figure`, `row`/`col`) funcionam dentro dos slides e substituem os `.deck-*`.
- `slideClass: 'container'` aplica a largura e o espaçamento do Bootstrap ao conteúdo.
- As cores podem vir das variáveis do Bootstrap: `:root { --pp-primary: var(--bs-primary); }`.

## API

| Método | Descrição |
| :---- | :---- |
| `PagePresenter.open(opcoes)` | Monta os slides e abre em tela cheia. Retorna `false` se não houver o que apresentar. |
| `PagePresenter.close()` | Encerra a apresentação. |
| `PagePresenter.next()` / `prev()` | Avança ou volta um passo (`data-step`) ou um slide. |
| `PagePresenter.goTo(indice)` | Vai direto a um slide, sem passos revelados. |
| `PagePresenter.openNotes()` | Abre a janela de notas do apresentador. Retorna `false` se o pop-up for bloqueado. |
| `PagePresenter.isOpen()`, `slideCount()`, `currentIndex()` | Estado atual. |

## Compatibilidade e limitações

- O ajuste automático ao tamanho da tela usa a propriedade CSS `zoom`, presente no Chrome, no Edge, no Safari e no Firefox 126 ou mais recente.
- O visual de capa clareia o × e o rodapé com `:has()`, presente nos mesmos navegadores. Sem ele, o × fica escuro sobre a capa.
- Se o navegador recusar a tela cheia nativa, a apresentação continua ocupando a janela inteira.
- Os slides clonados usam o CSS da página para o próprio conteúdo.
- Com `prefers-reduced-motion`, as animações são desligadas. Na impressão, a apresentação fica oculta.

## Testes

Abra `tests/tests.html` no navegador e confira se todas as linhas aparecem em verde. A página carrega só o `page-presenter.css`, o que também confirma que a moldura funciona sem o tema.

`tests/test-tailwind.html` e `tests/test-bootstrap.html` carregam o framework por CDN e conferem a convivência:
- os slides não herdam regras de `section` da página;
- o × e a caixa do slide resistem ao reset do framework;
- os componentes `.deck-*` vencem o reset;
- os utilitários do framework vencem o tema;
- `slideClass` funciona.

Os botões dessas páginas permitem conferir o visual à mão.

As páginas também rodam sem interface, no Chrome ou no Edge:

```sh
chrome --headless=new --virtual-time-budget=8000 --dump-dom file:///caminho/tests/tests.html | grep -o 'class="fail"' | wc -l
```

O resultado `0` significa que nenhuma verificação falhou.
