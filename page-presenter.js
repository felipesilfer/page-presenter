/**
 * Page Presenter
 * Transforma o conteúdo de uma página HTML em uma apresentação de slides em tela cheia.
 * HTML + CSS + JavaScript puro, sem dependências.
 *
 * Uso:
 *   PagePresenter.open({
 *     source: '#artigo',                 // seletor, elemento ou função que retorna o elemento
 *     title: 'Título da capa',           // opcional (texto ou função)
 *     category: 'Categoria da capa',     // opcional (texto ou função)
 *     sectionSelector: '.secao',         // filhos diretos que viram um slide cada
 *     closingSelector: '.fechamento'     // opcional: filhos que viram slide de fechamento
 *   });
 *   PagePresenter.close();
 *
 * Roteiro próprio: se o elemento de origem tiver um filho direto .presentation-deck,
 * cada .deck-slide dentro dele vira um slide (data-variant="cover" usa o visual de capa)
 * e o conteúdo do artigo é ignorado.
 */
(function (global) {
  'use strict';

  let overlay, stage, counter, progress, closeBtn;
  let slides = [];
  let currentSlide = 0;
  let isOpen = false;
  let focusBefore = null;

  const resolve = (value) => (typeof value === 'function' ? value() : value);

  function resolveElement(source) {
    const value = resolve(source);
    return typeof value === 'string' ? document.querySelector(value) : value;
  }

  // Cria o overlay uma única vez, no primeiro uso
  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'presentation-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Modo apresentação');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.tabIndex = -1;
    overlay.innerHTML = `
      <button type="button" class="presentation-close-btn" title="Sair da apresentação (Esc)"
        aria-label="Sair da apresentação">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="presentation-stage" aria-live="polite"></div>
      <div class="presentation-footer">
        <span class="presentation-hint">← → ou Espaço para navegar · Esc para sair</span>
        <span class="presentation-counter">1 / 1</span>
      </div>
      <div class="presentation-progress"><div class="presentation-progress-bar"></div></div>`;
    document.body.appendChild(overlay);

    stage = overlay.querySelector('.presentation-stage');
    counter = overlay.querySelector('.presentation-counter');
    progress = overlay.querySelector('.presentation-progress-bar');
    closeBtn = overlay.querySelector('.presentation-close-btn');

    closeBtn.addEventListener('click', close);

    // Esc em tela cheia é consumido pelo navegador: sair da tela cheia encerra a apresentação
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && isOpen) close();
      else if (isOpen) showSlide(currentSlide);
    });

    document.addEventListener('keydown', onKeydown);

    // Navegação por toque (deslizar)
    let touchStartX = null, touchStartY = 0;
    overlay.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });
    overlay.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      // Só gesto predominantemente horizontal troca de slide; vertical é rolagem
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        showSlide(currentSlide + (deltaX < 0 ? 1 : -1));
      }
      touchStartX = null;
    });

    window.addEventListener('resize', () => {
      if (isOpen) fitSlide(slides[currentSlide]);
    });
  }

  function onKeydown(e) {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        showSlide(currentSlide + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'Backspace':
        e.preventDefault();
        showSlide(currentSlide - 1);
        break;
      case 'Home':
        e.preventDefault();
        showSlide(0);
        break;
      case 'End':
        e.preventDefault();
        showSlide(slides.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        // Mantém o foco dentro da apresentação
        e.preventDefault();
        closeBtn.focus();
        break;
    }
  }

  // Copia um bloco da página sem IDs duplicados nem botões de ação
  function cloneForSlide(node) {
    const clone = node.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    clone.querySelectorAll('button').forEach(el => el.remove());
    return clone;
  }

  function createSlide(extraClass) {
    const slide = document.createElement('section');
    slide.className = `presentation-slide ${extraClass || ''}`.trim();
    const inner = document.createElement('div');
    inner.className = 'presentation-slide-inner';
    slide.appendChild(inner);
    return slide;
  }

  // Monta os slides: capa (título + introdução), uma seção por slide e o fechamento
  function buildSlides(options) {
    const container = resolveElement(options.source);
    const built = [];
    if (!container) return built;

    // Roteiro próprio: substitui os slides gerados a partir do conteúdo
    const deck = container.querySelector(':scope > .presentation-deck');
    if (deck) {
      deck.querySelectorAll(':scope > .deck-slide').forEach(source => {
        const variant = source.dataset.variant === 'cover' ? 'slide-cover slide-deck' : 'slide-deck';
        const slide = createSlide(variant);
        const clone = cloneForSlide(source);
        clone.removeAttribute('hidden');
        while (clone.firstChild) slide.firstChild.appendChild(clone.firstChild);
        built.push(slide);
      });
      return built;
    }

    const cover = createSlide('slide-cover');
    const categoryText = resolve(options.category);
    if (categoryText) {
      const category = document.createElement('span');
      category.className = 'slide-category';
      category.textContent = categoryText;
      cover.firstChild.appendChild(category);
    }
    const title = document.createElement('h1');
    title.className = 'slide-cover-title';
    title.textContent = resolve(options.title) || document.title;
    const coverBody = document.createElement('div');
    coverBody.className = 'slide-cover-body';
    cover.firstChild.append(title, coverBody);
    built.push(cover);

    const sectionSelector = options.sectionSelector || 'section';
    const closingSelector = options.closingSelector;

    Array.from(container.children).forEach(child => {
      const isClosing = closingSelector && child.matches(closingSelector);
      if (isClosing || child.matches(sectionSelector)) {
        const slide = createSlide(isClosing ? 'slide-closing' : '');
        slide.firstChild.appendChild(cloneForSlide(child));
        built.push(slide);
      } else if (built.length === 1) {
        // Conteúdo antes da primeira seção entra na capa
        coverBody.appendChild(cloneForSlide(child));
      } else {
        // Conteúdo solto entre seções acompanha a seção anterior
        built[built.length - 1].firstChild.appendChild(cloneForSlide(child));
      }
    });

    return built;
  }

  // Ajusta o zoom do slide para caber na tela (amplia slides curtos, reduz os longos)
  function fitSlide(slide) {
    const inner = slide.firstChild;
    inner.style.zoom = 1;
    const styles = getComputedStyle(slide);
    const availH = slide.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
    const availW = slide.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const ratio = Math.min(availH / inner.scrollHeight, availW / inner.offsetWidth);
    const zoom = Math.max(0.6, Math.min(1.5, ratio));
    inner.style.zoom = zoom.toFixed(3);
  }

  function showSlide(index) {
    if (!slides.length) return;
    currentSlide = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => slide.classList.toggle('active', i === currentSlide));
    const active = slides[currentSlide];
    active.scrollTop = 0;
    fitSlide(active);
    counter.textContent = `${currentSlide + 1} / ${slides.length}`;
    progress.style.width = `${((currentSlide + 1) / slides.length) * 100}%`;
  }

  function open(options) {
    ensureOverlay();
    if (isOpen) close();

    slides = buildSlides(options || {});
    if (!slides.length) return false;

    stage.innerHTML = '';
    slides.forEach(slide => stage.appendChild(slide));

    focusBefore = document.activeElement;
    isOpen = true;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('presentation-active');
    showSlide(0);
    overlay.focus();

    if (overlay.requestFullscreen) {
      overlay.requestFullscreen().catch(() => { /* segue em overlay sem tela cheia nativa */ });
    }
    return true;
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('presentation-active');
    stage.innerHTML = '';
    slides = [];

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
    if (focusBefore && focusBefore.focus) focusBefore.focus();
  }

  global.PagePresenter = {
    open,
    close,
    isOpen: () => isOpen,
    slideCount: () => slides.length,
    currentIndex: () => currentSlide,
    next: () => showSlide(currentSlide + 1),
    prev: () => showSlide(currentSlide - 1),
    goTo: (index) => showSlide(index)
  };
})(window);
