# Page Presenter

Transforma o conteúdo de uma página HTML em uma **apresentação de slides em tela cheia**. Feito só com HTML, CSS e JavaScript, sem dependências e sem etapa de build.

## Arquivos

| Arquivo | Conteúdo |
| :---- | :---- |
| `page-presenter.js` | O módulo. Expõe o objeto global `PagePresenter`. |
| `page-presenter.css` | Estilos da apresentação e dos componentes de slide. |
| `index.html` | Demonstração com os dois modos de uso. |
| `tests.html` | Testes: abra no navegador e confira se todas as linhas ficam verdes. |

## Como usar

```html
<link rel="stylesheet" href="page-presenter.css">
<script src="page-presenter.js"></script>

<button id="btn-present">Apresentar</button>

<script>
  document.getElementById('btn-present').addEventListener('click', () => {
    PagePresenter.open({
      source: '#artigo',              // seletor, elemento ou função que retorna o elemento
      title: 'Título da capa',        // opcional; padrão: document.title
      category: 'Categoria',          // opcional
      sectionSelector: '.secao',      // padrão: 'section'
      closingSelector: '.fechamento'  // opcional
    });
  });
</script>
```

`title`, `category` e `source` também aceitam funções, avaliadas a cada abertura. Isso é útil quando o conteúdo exibido muda, como em páginas com abas.

### Como os slides são montados

1. **Capa:** a categoria, o título e todo o conteúdo que vem antes da primeira seção.  
2. **Seções:** cada filho direto de `source` que corresponde a `sectionSelector` vira um slide.  
3. **Conteúdo solto** entre seções entra no slide da seção anterior.  
4. **Fechamento:** filhos que correspondem a `closingSelector` viram um slide com visual de fechamento.

Os blocos são copiados da página sem IDs, para não duplicá-los, e sem botões, que não funcionariam no slide.

### Roteiro próprio

Para escrever os slides à mão, coloque um `.presentation-deck` oculto como filho direto de `source`. Cada `.deck-slide` vira um slide, e o resto do conteúdo é ignorado:

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

Componentes disponíveis para os slides:

| Classe | Uso |
| :---- | :---- |
| `.deck-title`, `.deck-subtitle`, `.deck-text` | Título, subtítulo em destaque e texto |
| `.deck-statement` | Frase de destaque com barra lateral |
| `.deck-flow` (`.deck-flow-muted`) | Etapas com setas entre elas |
| `.deck-checklist` | Lista com marcas de ✓ |
| `.deck-products` (`.deck-products-more`) | Etiquetas |
| `.deck-network`, `.deck-network-node`, `.deck-network-arrow` | Dois blocos ligados por seta (variantes `-threat` e `-response`) |

## Navegação

| Ação | Teclas |
| :---- | :---- |
| Avançar slide | `→` `↓` `Espaço` `Page Down` |
| Voltar slide | `←` `↑` `Backspace` `Page Up` |
| Primeiro / último slide | `Home` / `End` |
| Sair | `Esc` ou o botão **×** no canto superior direito |

Em telas de toque, deslize o dedo para os lados. Cada slide se ajusta ao tamanho da tela, e slides muito longos ganham rolagem.

## API

| Método | Descrição |
| :---- | :---- |
| `PagePresenter.open(opcoes)` | Monta os slides e abre em tela cheia. Retorna `false` se não houver o que apresentar. |
| `PagePresenter.close()` | Encerra a apresentação. |
| `PagePresenter.next()` / `prev()` / `goTo(indice)` | Navegação programática. |
| `PagePresenter.isOpen()`, `slideCount()`, `currentIndex()` | Estado atual. |

## Personalização

As cores e medidas são variáveis CSS com prefixo `--pp-`, definidas em `:root`. Para mudar, redefina-as no seu CSS depois de carregar `page-presenter.css`:

```css
:root {
  --pp-primary: #6b21a8;
  --pp-primary-deep: #3b0764;
  --pp-accent: #a855f7;
  --pp-highlight: #facc15;
}
```

## Compatibilidade

- O ajuste automático ao tamanho da tela usa a propriedade CSS `zoom`, presente no Chrome, no Edge, no Safari e no Firefox 126 ou mais recente.  
- Se o navegador recusar a tela cheia nativa, a apresentação continua ocupando a janela inteira.  
- Os textos da interface (dica de navegação e rótulos do botão de fechar) estão em português, dentro de `page-presenter.js`.