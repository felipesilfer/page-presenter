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
 *     closingSelector: '.fechamento',    // opcional: filhos que viram slide de fechamento
 *     labels: { hint, close, dialog },   // opcional: textos da interface
 *     hash: true,                        // opcional: guarda o slide na URL (#slide-3)
 *     onChange: (indice, total) => {},   // opcional: chamada a cada troca de slide
 *     slideClass: 'prose'                // opcional: classes extras no recipiente de cada slide
 *   });
 *   PagePresenter.close();
 *   PagePresenter.openNotes();           // janela de notas do apresentador (tecla N)
 *
 * Roteiro próprio: se o elemento de origem tiver um filho direto .presentation-deck,
 * cada .deck-slide dentro dele vira um slide (data-variant="cover" usa o visual de capa)
 * e o conteúdo do artigo é ignorado.
 *
 * Dentro de qualquer slide: elementos com [data-step] aparecem um por vez a cada avanço,
 * e .deck-notes guarda notas que só aparecem na janela do apresentador.
 */
(function (global) {
  'use strict';

  let overlay, stage, counter, progress, closeBtn;
  let slides = [];
  let currentSlide = 0;
  let isOpen = false;
  let focusBefore = null;
  let opts = {};
  let lastNotified = -1;
  let revealed = 0; // quantos [data-step] do slide atual estão visíveis
  let notesWin = null, notesTimer = null, startedAt = 0, keepOnExit = false;

  const LABELS = {
    dialog: 'Modo apresentação',
    close: 'Sair da apresentação',
    hint: '← → ou Espaço para navegar · N abre as notas · Esc para sair'
  };
  const FOCUSABLE = 'a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), ' +
    'summary, iframe, audio[controls], video[controls], [tabindex]:not([tabindex="-1"]), ' +
    '[contenteditable]:not([contenteditable="false"])';
  const HASH_RE = /^#slide-(\d+)$/;

  // Troca o fragmento da URL sem criar entrada no histórico (null remove o fragmento)
  function setUrl(hash) {
    try {
      history.replaceState(null, '', hash || location.pathname + location.search);
    } catch (err) {
      // Chrome recusa replaceState em file://; a navegação por fragmento funciona.
      // shortcut: em file:// o #slide-N fica na URL ao fechar, para não rolar a página ao topo com '#'.
      if (hash) location.replace(hash);
    }
  }

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
    overlay.setAttribute('aria-hidden', 'true');
    overlay.tabIndex = -1;
    overlay.innerHTML = `
      <button type="button" class="presentation-close-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="presentation-stage" aria-live="polite"></div>
      <div class="presentation-footer">
        <span class="presentation-hint"></span>
        <span class="presentation-counter">1 / 1</span>
      </div>
      <div class="presentation-progress"><div class="presentation-progress-bar"></div></div>`;
    document.body.appendChild(overlay);

    stage = overlay.querySelector('.presentation-stage');
    counter = overlay.querySelector('.presentation-counter');
    progress = overlay.querySelector('.presentation-progress-bar');
    closeBtn = overlay.querySelector('.presentation-close-btn');

    closeBtn.addEventListener('click', close);

    // Clique na metade direita avança, na esquerda volta (controles remotos emulam clique)
    stage.addEventListener('click', (e) => {
      if (e.target.closest(`${FOCUSABLE}, button, label`) || String(window.getSelection())) return;
      step(e.clientX >= window.innerWidth / 2 ? 1 : -1);
    });

    // Esc em tela cheia é consumido pelo navegador: sair da tela cheia encerra a apresentação.
    // A exceção é a saída provocada pela abertura da janela de notas (keepOnExit).
    document.addEventListener('fullscreenchange', () => {
      if (!isOpen) return;
      if (!document.fullscreenElement && !keepOnExit) close();
      else fitSlide(slides[currentSlide]);
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
        step(deltaX < 0 ? 1 : -1);
      }
      touchStartX = null;
    });

    window.addEventListener('resize', () => {
      if (isOpen) fitSlide(slides[currentSlide]);
    });
  }

  function onKeydown(e) {
    if (!isOpen) return;
    // Preserva atalhos do navegador (Alt+←, Ctrl+Home...) e a digitação em campos
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key !== 'Escape' && e.key !== 'Tab' && e.target.closest &&
      e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        step(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'Backspace':
        e.preventDefault();
        step(-1);
        break;
      case 'n':
      case 'N':
        e.preventDefault();
        openNotes();
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
      case 'Tab': {
        // Circula entre o × e os elementos focáveis visíveis do slide ativo
        e.preventDefault();
        const items = [closeBtn, ...slides[currentSlide].querySelectorAll(FOCUSABLE)]
          .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
        const i = items.indexOf(document.activeElement);
        const step = e.shiftKey ? -1 : 1;
        const next = i < 0 ? (e.shiftKey ? items.length - 1 : 0) : (i + step + items.length) % items.length;
        items[next].focus();
        break;
      }
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

  // <div> e não <section>: regras da página como "section { min-height: 100vh }" não vazam para o slide
  function createSlideBase(extraClass, innerClass) {
    const slide = document.createElement('div');
    slide.className = `presentation-slide ${extraClass || ''}`.trim();
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    const inner = document.createElement('div');
    inner.className = `presentation-slide-inner ${innerClass || ''}`.trim();
    slide.appendChild(inner);
    return slide;
  }

  // Monta os slides: capa (título + introdução), uma seção por slide e o fechamento
  function buildSlides(options) {
    const container = resolveElement(options.source);
    const built = [];
    if (!container) return built;
    // slideClass: classes extras no recipiente de cada slide (ex.: 'prose' do Tailwind, 'container' do Bootstrap)
    const createSlide = (extraClass) => createSlideBase(extraClass, options.slideClass);

    // Roteiro próprio: substitui os slides gerados a partir do conteúdo
    const deck = container.querySelector(':scope > .presentation-deck');
    if (deck) {
      deck.querySelectorAll(':scope > .deck-slide').forEach(source => {
        const variant = source.dataset.variant === 'cover' ? 'presentation-cover presentation-from-deck' : 'presentation-from-deck';
        const slide = createSlide(variant);
        const clone = cloneForSlide(source);
        clone.removeAttribute('hidden');
        while (clone.firstChild) slide.firstChild.appendChild(clone.firstChild);
        built.push(slide);
      });
      return built;
    }

    const cover = createSlide('presentation-cover');
    const categoryText = resolve(options.category);
    if (categoryText) {
      const category = document.createElement('span');
      category.className = 'presentation-category';
      category.textContent = categoryText;
      cover.firstChild.appendChild(category);
    }
    const title = document.createElement('h1');
    title.className = 'presentation-cover-title';
    title.textContent = resolve(options.title) || document.title;
    const coverBody = document.createElement('div');
    coverBody.className = 'presentation-cover-body';
    cover.firstChild.append(title, coverBody);
    built.push(cover);

    const sectionSelector = options.sectionSelector || 'section';
    const closingSelector = options.closingSelector;

    Array.from(container.children).forEach(child => {
      const isClosing = closingSelector && child.matches(closingSelector);
      if (isClosing || child.matches(sectionSelector)) {
        const slide = createSlide(isClosing ? 'presentation-closing' : '');
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

  const stepsOf = (slide) => slide.querySelectorAll('[data-step]');

  function applySteps() {
    stepsOf(slides[currentSlide]).forEach((el, i) => el.classList.toggle('presentation-step-visible', i < revealed));
    renderNotes();
  }

  // Avança/volta um passo: revela ou esconde o próximo [data-step] antes de trocar de slide.
  // Ao voltar para o slide anterior, ele aparece com todos os passos revelados.
  function step(dir) {
    if (!slides.length) return;
    const total = stepsOf(slides[currentSlide]).length;
    if (dir > 0 && revealed < total) revealed++;
    else if (dir < 0 && revealed > 0) revealed--;
    else {
      const target = currentSlide + dir;
      if (target >= 0 && target < slides.length) showSlide(target, dir < 0);
      return;
    }
    applySteps();
  }

  function showSlide(index, revealAll) {
    if (!slides.length) return;
    currentSlide = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => slide.classList.toggle('active', i === currentSlide));
    const active = slides[currentSlide];
    revealed = revealAll ? stepsOf(active).length : 0;
    applySteps();
    active.scrollTop = 0;
    fitSlide(active);
    counter.textContent = `${currentSlide + 1} / ${slides.length}`;
    progress.style.width = `${((currentSlide + 1) / slides.length) * 100}%`;

    if (currentSlide === lastNotified) return;
    lastNotified = currentSlide;
    if (opts.hash) setUrl(`#slide-${currentSlide + 1}`);
    if (typeof opts.onChange === 'function') opts.onChange(currentSlide, slides.length);
  }

  function open(options) {
    ensureOverlay();
    const built = buildSlides(options || {});
    if (!built.length) return false;

    // Trocando de uma apresentação com hash para outra sem: não deixa #slide-N velho na URL
    if (isOpen && opts.hash && !(options || {}).hash && HASH_RE.test(location.hash)) setUrl(null);
    opts = options || {};
    slides = built;
    stage.innerHTML = '';
    slides.forEach(slide => stage.appendChild(slide));

    const labels = Object.assign({}, LABELS, opts.labels);
    overlay.setAttribute('aria-label', labels.dialog);
    closeBtn.setAttribute('aria-label', labels.close);
    closeBtn.title = `${labels.close} (Esc)`;
    overlay.querySelector('.presentation-hint').textContent = labels.hint;

    // Já aberta: só troca os slides, sem sair e reentrar na tela cheia
    if (!isOpen) {
      focusBefore = document.activeElement;
      startedAt = Date.now();
      isOpen = true;
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('presentation-active');
      if (overlay.requestFullscreen) {
        overlay.requestFullscreen().catch(() => { /* segue em overlay sem tela cheia nativa */ });
      }
    }

    const fromHash = opts.hash && HASH_RE.exec(location.hash);
    lastNotified = -1;
    showSlide(fromHash ? Number(fromHash[1]) - 1 : 0);
    overlay.focus();
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
    currentSlide = 0;
    if (opts.hash && HASH_RE.test(location.hash)) setUrl(null);
    renderNotes();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
    if (focusBefore && focusBefore.focus) focusBefore.focus();
  }

  // ---- Notas do apresentador: segunda janela com notas, próximo slide e cronômetro ----

  const NOTES_PAGE = `
    <style>
      body { margin: 0; padding: 1.5rem; font: 18px/1.5 system-ui, sans-serif; color: #1e293b; background: #f8fafc; }
      .bar { display: flex; justify-content: space-between; font-weight: 700; color: #475569; }
      .clock { font-variant-numeric: tabular-nums; font-size: 1.6rem; color: #004b82; }
      .notes { margin: 1.25rem 0; padding: 1.25rem; font-size: 1.35rem; background: #fff;
               border: 1px solid #dbe3eb; border-radius: 12px; }
      .next { color: #64748b; }
    </style>
    <div class="bar"><span class="pos"></span><span class="clock">00:00</span></div>
    <div class="notes"></div>
    <div class="next"></div>`;

  function openNotes() {
    if (notesWin && !notesWin.closed) {
      notesWin.focus();
      return true;
    }
    // shortcut: o Chrome pode sair da tela cheia ao abrir uma janela; essa saída é ignorada por 1 s.
    // Se a apresentação fechar ao abrir as notas, abra as notas antes de apresentar.
    keepOnExit = !!document.fullscreenElement;
    setTimeout(() => { keepOnExit = false; }, 1000);

    notesWin = window.open('', 'page-presenter-notes', 'width=760,height=560');
    if (!notesWin) return false; // bloqueador de pop-up
    const doc = notesWin.document;
    doc.title = 'Notas do apresentador';
    doc.documentElement.lang = 'pt-BR';
    doc.body.innerHTML = NOTES_PAGE;
    // As teclas da janela de notas também conduzem a apresentação (menos Tab, que é do foco local)
    doc.addEventListener('keydown', (e) => { if (e.key !== 'Tab') onKeydown(e); });
    clearInterval(notesTimer);
    notesTimer = setInterval(renderClock, 1000);
    renderNotes();
    return true;
  }

  function slideTitle(slide) {
    const heading = slide.querySelector('h1, h2, h3');
    const text = (heading || slide.firstChild).textContent.replace(/\s+/g, ' ').trim();
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }

  function renderClock() {
    if (!notesWin || notesWin.closed) {
      clearInterval(notesTimer);
      return;
    }
    const secs = isOpen ? Math.floor((Date.now() - startedAt) / 1000) : 0;
    const pad = (n) => String(n).padStart(2, '0');
    notesWin.document.querySelector('.clock').textContent = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
  }

  function renderNotes() {
    if (!notesWin || notesWin.closed) return;
    const doc = notesWin.document;
    const pos = doc.querySelector('.pos');
    const notes = doc.querySelector('.notes');
    const next = doc.querySelector('.next');
    notes.textContent = '';
    renderClock();
    if (!isOpen) {
      pos.textContent = 'Nenhuma apresentação aberta';
      next.textContent = '';
      return;
    }
    const slide = slides[currentSlide];
    const total = stepsOf(slide).length;
    pos.textContent = `Slide ${currentSlide + 1} de ${slides.length}` +
      (total ? ` · passo ${revealed} de ${total}` : '');
    slide.querySelectorAll('.deck-notes').forEach(n => {
      notes.append(...Array.from(n.cloneNode(true).childNodes));
    });
    if (!notes.childNodes.length) notes.textContent = 'Sem notas para este slide.';
    const following = slides[currentSlide + 1];
    next.textContent = following ? `Próximo: ${slideTitle(following)}` : 'Este é o último slide.';
  }

  global.PagePresenter = {
    open,
    close,
    openNotes,
    isOpen: () => isOpen,
    slideCount: () => slides.length,
    currentIndex: () => currentSlide,
    next: () => step(1),
    prev: () => step(-1),
    goTo: (index) => showSlide(index)
  };
})(window);
