/**
 * Snack El Idrissi — Application
 * Loads data from data.json and renders the full site dynamically.
 */

'use strict';

/* ============================================================
   STATE
   ============================================================ */
const State = {
  lang:       'fr',
  dir:        'ltr',
  category:   'all',
  query:      '',
  cart:       [],
  carouselIdx: 0,
  carouselTimer: null,
  lightboxIdx: 0,
  searchTimer: null,
  lbTouchX:   0,
  carTouchX:  0,
  data:       null,          // filled after fetch
};

/* ============================================================
   HELPERS
   ============================================================ */
function $(id)  { return document.getElementById(id); }
function $$(sel){ return document.querySelectorAll(sel); }

/** Translate a key using loaded translations */
function t(key) {
  const translations = State.data?.translations;
  if (!translations) return key;
  return translations[State.lang]?.[key] ?? translations['fr']?.[key] ?? key;
}

/** Safely escape HTML to prevent XSS */
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

/** Highlight search query inside already-escaped HTML */
function highlight(escapedHtml, query) {
  if (!query) return escapedHtml;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escapedHtml.replace(new RegExp(safe, 'gi'), m => `<mark>${m}</mark>`);
}

/** Localised item name/desc fallback chain */
function loc(obj) {
  return obj?.[State.lang] ?? obj?.['fr'] ?? '';
}

/** Format result count string */
function formatCount(n) {
  const key = n === 1 ? 'results_found' : 'results_found_plural';
  return t(key).replace('{n}', n);
}

/* ============================================================
   LOCAL STORAGE (safe wrappers)
   ============================================================ */
function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

/* ============================================================
   DATA LOADING
   ============================================================ */
async function loadData() {
  const res  = await fetch('./data.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  State.data = await res.json();
}

/* ============================================================
   LOADER
   ============================================================ */
function initLoader() {
  const nameEl = $('loader-name');
  if (!nameEl) return;
  'Snack El Idrissi'.split('').forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch === ' ' ? '\u00a0' : ch;
    s.style.animationDelay = `${0.8 + i * 0.06}s`;
    nameEl.appendChild(s);
  });
  setTimeout(() => {
    const loader = $('loader');
    if (!loader) return;
    loader.style.transition = 'opacity 0.4s ease';
    loader.style.opacity    = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => { loader.style.display = 'none'; }, 420);
  }, 2800);
}

/* ============================================================
   LANGUAGE
   ============================================================ */
function setLanguage(lang, skipRender = false) {
  State.lang = lang;
  State.dir  = lang === 'ar' ? 'rtl' : 'ltr';
  lsSet('lang', lang);

  const html = document.documentElement;
  html.lang      = lang;
  html.dir       = State.dir;
  html.className = `lang-${lang}`;

  $$('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });

  applyStaticTranslations();
  if (!skipRender) {
    renderMenu();
    renderTestimonials();
  }
}

/** Update all [data-i18n] and [data-i18n-placeholder] elements */
function applyStaticTranslations() {
  $$('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val !== el.dataset.i18n) el.textContent = val;
  });
  $$('[data-i18n-placeholder]').forEach(el => {
    const val = t(el.dataset.i18nPlaceholder);
    if (val !== el.dataset.i18nPlaceholder) el.placeholder = val;
  });
}

/* ============================================================
   SCROLL EFFECTS
   ============================================================ */
function initScrollEffects() {
  const header   = $('header');
  const progress = $('scroll-progress');
  const backTop  = $('back-to-top');
  const zellige  = $('hero-zellige');
  const sections = ['hero','menu','about','gallery','testimonials','info-band'];

  window.addEventListener('scroll', () => {
    const y   = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    if (progress) progress.style.width = max > 0 ? `${(y / max) * 100}%` : '0%';
    if (header)   header.classList.toggle('scrolled', y > 80);
    if (backTop)  backTop.classList.toggle('visible', y > 400);
    if (zellige)  zellige.style.transform = `translateY(${y * 0.28}px)`;

    // Active nav link
    let current = 'hero';
    sections.forEach(id => {
      const el = $(id);
      if (el && el.getBoundingClientRect().top < 110) current = id;
    });
    $$('.nav-link').forEach(a => {
      const href = (a.getAttribute('href') || '').replace('#', '');
      a.classList.toggle('active', href === current);
    });
  }, { passive: true });
}

/* ============================================================
   STAT COUNTERS (Intersection Observer)
   ============================================================ */
function initCounters() {
  const els = $$('[data-count]');
  if (!els.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el      = entry.target;
      const target  = parseFloat(el.dataset.count);
      const decimal = parseInt(el.dataset.decimal || '0', 10);
      const dur     = 1500;
      const start   = performance.now();

      function tick(now) {
        const p      = Math.min((now - start) / dur, 1);
        const eased  = 1 - Math.pow(1 - p, 3);
        el.textContent = decimal > 0
          ? (eased * target).toFixed(decimal)
          : Math.round(eased * target).toString();
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  els.forEach(el => observer.observe(el));
}

/* ============================================================
   TYPEWRITER
   ============================================================ */
(function initTypewriter() {
  let langIdx = 0, charIdx = 0, deleting = false, timer = null;

  function tick() {
    const el = $('hero-typewriter');
    if (!el || !State.data) { timer = setTimeout(tick, 200); return; }

    const lines = t('hero_typewriter');                    // array of strings
    const texts = Array.isArray(lines) ? lines : [lines]; // guard
    const text  = texts[langIdx % texts.length];

    if (!deleting) {
      el.textContent = text.slice(0, charIdx + 1);
      charIdx++;
      if (charIdx === text.length) {
        deleting = true;
        timer = setTimeout(tick, 2800);
        return;
      }
    } else {
      el.textContent = text.slice(0, charIdx - 1);
      charIdx--;
      if (charIdx === 0) {
        deleting = false;
        langIdx  = (langIdx + 1) % texts.length;
      }
    }
    timer = setTimeout(tick, deleting ? 38 : 78);
  }

  // Expose so setLanguage can restart it
  window._twTick = tick;
  setTimeout(tick, 1000);
})();

/* ============================================================
   MOBILE MENU
   ============================================================ */
function toggleMobileMenu() {
  const menu   = $('mobile-menu');
  const burger = $('hamburger');
  if (!menu || !burger) return;
  const open = menu.classList.toggle('open');
  burger.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

function closeMobileMenu() {
  $('mobile-menu')?.classList.remove('open');
  $('hamburger')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ============================================================
   MENU — TABS
   ============================================================ */
function renderCategoryTabs() {
  const container = $('category-tabs');
  if (!container || !State.data) return;

  const { categories, menu } = State.data;
  container.innerHTML = '';

  categories.forEach(cat => {
    const count = cat.id === 'all'
      ? menu.length
      : menu.filter(i => i.category === cat.id).length;

    const btn = document.createElement('button');
    btn.className = `tab-btn${cat.id === State.category ? ' active' : ''}`;
    btn.setAttribute('aria-pressed', cat.id === State.category ? 'true' : 'false');
    btn.innerHTML = `${cat.icon} <span>${t('cat_' + cat.id)}</span><span class="tab-count">${count}</span>`;
    btn.addEventListener('click', () => {
      State.category = cat.id;
      renderMenu();
    });
    container.appendChild(btn);
  });
}

/* ============================================================
   MENU — GRID
   ============================================================ */
function renderMenuItems() {
  const grid    = $('menu-grid');
  const countEl = $('results-count');
  if (!grid || !State.data) return;

  const q = State.query.toLowerCase();

  let items = State.data.menu.filter(item => {
    const catOk  = State.category === 'all' || item.category === State.category;
    if (!catOk) return false;
    if (!q) return true;
    return loc(item.name).toLowerCase().includes(q) ||
           loc(item.desc).toLowerCase().includes(q);
  });

  // Update count label
  if (countEl) {
    countEl.textContent = (State.query || State.category !== 'all') ? formatCount(items.length) : '';
  }

  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="menu-empty">
        <svg width="80" height="80" fill="none" stroke="#9A8A6A" stroke-width="1.5" viewBox="0 0 24 24">
          <path d="M3 2v1a3 3 0 003 3h1v1a2 2 0 01-2 2H4a1 1 0 000 2h16a1 1 0 000-2h-1a2 2 0 01-2-2V6h1a3 3 0 003-3V2H3z"/>
          <path d="M6 20v1a1 1 0 001 1h10a1 1 0 001-1v-1"/>
        </svg>
        <h3>${t('no_results')}</h3>
        <p>${t('no_results_sub')}</p>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item, idx) => {
    const isSpecialWide = item.isSpecial && idx === 0 && State.category === 'all' && !State.query;
    const card = buildMenuCard(item, idx, isSpecialWide);
    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

function renderMenu() {
  renderCategoryTabs();
  renderMenuItems();
}

/* ============================================================
   MENU CARD BUILDER
   ============================================================ */
function buildMenuCard(item, idx, isWide) {
  const card = document.createElement('article');
  card.className = [
    'menu-card',
    item.isSpecial ? 'special' : '',
    isWide ? 'special-wide' : '',
  ].filter(Boolean).join(' ');

  // Entrance animation
  card.style.cssText = `opacity:0;transform:translateY(16px);transition:opacity 0.35s ${idx * 38}ms ease,transform 0.35s ${idx * 38}ms ease`;

  // --- Badges ---
  const badges = [
    item.popular   ? `<span class="badge badge-popular">${t('badge_popular')}</span>` : '',
    item.isNew     ? `<span class="badge badge-new">${t('badge_new')}</span>`         : '',
    item.isSpecial ? `<span class="badge badge-special">${t('badge_special')}</span>` : '',
    item.isVeg     ? `<span class="badge badge-veg">${t('badge_veg')}</span>`         : '',
  ].filter(Boolean).join('');

  // --- Spice ---
  const spiceHtml = item.spice > 0
    ? `<div class="spice-level" aria-label="Épicé: ${item.spice}/3">
        ${[1,2,3].map(lvl => {
          const active = lvl <= item.spice;
          const cls    = active ? `active-${Math.min(lvl, item.spice)}` : 'inactive';
          return `<svg class="spice-icon ${cls}" viewBox="0 0 24 24"
            fill="${active ? 'currentColor' : 'var(--bronze-dim)'}">
            <path d="M12 2C8 2 6 6 6 9c0 2.5 1 4.5 3 6l1 7h4l1-7c2-1.5 3-3.5 3-6 0-3-2-7-6-7z"/>
          </svg>`;
        }).join('')}
      </div>`
    : '';

  // --- Price ---
  const priceHtml = item.originalPrice
    ? `<span class="price-original">${item.originalPrice} MAD</span>
       <span class="price-current">${item.price} MAD</span>
       <span class="price-badge">-${Math.round((1 - item.price / item.originalPrice) * 100)}%</span>`
    : `<span class="price-current">${item.price} MAD</span>`;

  // --- Highlighted text ---
  const nameHL = highlight(escHtml(loc(item.name)), State.query);
  const descHL = highlight(escHtml(loc(item.desc)), State.query);

  card.innerHTML = `
    ${badges ? `<div class="card-badges">${badges}</div>` : ''}
    <div class="card-img-wrap">
      <img src="${escHtml(item.image)}" alt="${escHtml(loc(item.name))}" loading="lazy">
      <span class="card-cat-badge">${t('cat_' + item.category)}</span>
    </div>
    <div class="card-body">
      <div class="card-name">${nameHL}</div>
      <div class="card-desc">${descHL}</div>
      ${spiceHtml}
      <div class="card-footer">
        <div class="card-price">${priceHtml}</div>
        <div class="card-actions">
          <div class="qty-controls" role="group" aria-label="Quantité">
            <button class="qty-btn js-qty-dec" aria-label="${t('prev')}">−</button>
            <span class="qty-value" data-item-id="${item.id}">1</span>
            <button class="qty-btn js-qty-inc" aria-label="${t('next')}">+</button>
          </div>
          <button class="btn-add js-add-cart" data-item-id="${item.id}" aria-label="${t('btn_add')} ${escHtml(loc(item.name))}">
            ${t('btn_add')}
          </button>
        </div>
      </div>
    </div>`;

  // Qty controls
  card.querySelector('.js-qty-dec').addEventListener('click', () => adjustCardQty(card, -1));
  card.querySelector('.js-qty-inc').addEventListener('click', () => adjustCardQty(card,  1));

  // Add to cart
  card.querySelector('.js-add-cart').addEventListener('click', e => {
    addToCart(item.id, e.currentTarget);
  });

  // Trigger entrance
  requestAnimationFrame(() => requestAnimationFrame(() => {
    card.style.opacity   = '1';
    card.style.transform = 'translateY(0)';
  }));

  return card;
}

function adjustCardQty(card, delta) {
  const span = card.querySelector('.qty-value');
  if (!span) return;
  let v = parseInt(span.textContent, 10) + delta;
  if (v < 1) v = 1;
  span.textContent = v;
}

/* ============================================================
   SEARCH
   ============================================================ */
function onSearchInput() {
  clearTimeout(State.searchTimer);
  State.searchTimer = setTimeout(() => {
    const val = ($('search-input')?.value ?? '').trim();
    State.query = val;
    const clearBtn = $('search-clear');
    if (clearBtn) clearBtn.hidden = !val;
    renderMenuItems();
  }, 200);
}

function clearSearch() {
  State.query = '';
  const inp = $('search-input');
  if (inp) inp.value = '';
  const btn = $('search-clear');
  if (btn) btn.hidden = true;
  renderMenuItems();
}

/* ============================================================
   CART
   ============================================================ */
function addToCart(itemId, btn) {
  const item = State.data?.menu.find(i => i.id === itemId);
  if (!item) return;

  // Read qty from card
  const card = btn?.closest('.menu-card');
  const qtyEl = card?.querySelector('.qty-value');
  const qty = parseInt(qtyEl?.textContent || '1', 10);

  const existing = State.cart.find(i => i.id === itemId);
  if (existing) existing.qty += qty;
  else State.cart.push({ ...item, qty });

  saveCart();
  updateCartBadge();

  // Ripple on button
  if (btn) {
    btn.classList.add('ripple');
    setTimeout(() => btn.classList.remove('ripple'), 500);
  }

  // Fly animation
  const imgEl = card?.querySelector('img');
  if (imgEl) flyToCart(imgEl);

  showToast(`${loc(item.name)} ${t('toast_added')}`, 'success');
}

function removeFromCart(itemId) {
  const item = State.cart.find(i => i.id === itemId);
  if (item) showToast(`${loc(item.name)} ${t('toast_removed')}`, 'info');
  State.cart = State.cart.filter(i => i.id !== itemId);
  saveCart(); updateCartBadge(); renderCartItems();
}

function updateCartQty(itemId, delta) {
  const item = State.cart.find(i => i.id === itemId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) State.cart = State.cart.filter(i => i.id !== itemId);
  saveCart(); updateCartBadge(); renderCartItems();
}

function clearCart() {
  State.cart = [];
  saveCart(); updateCartBadge(); renderCartItems();
  showToast(t('toast_cleared'), 'info');
}

function saveCart() {
  lsSet('cart', State.cart);
}

function updateCartBadge() {
  const total = State.cart.reduce((s, i) => s + i.qty, 0);
  const badge = $('cart-badge');
  if (!badge) return;
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
  if (total > 0) {
    badge.classList.add('bounce');
    setTimeout(() => badge.classList.remove('bounce'), 400);
  }
}

/* ============================================================
   CART SIDEBAR RENDER
   ============================================================ */
function openCart() {
  $('cart-overlay')?.classList.add('open');
  $('cart-sidebar')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCart() {
  $('cart-overlay')?.classList.remove('open');
  $('cart-sidebar')?.classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartItems() {
  const container    = $('cart-items');
  const promoSec     = $('promo-section');
  const formSec      = $('cart-form');
  const summarySec   = $('cart-summary');
  const btnWa        = $('btn-whatsapp-order');
  const btnClear     = $('btn-clear-cart');
  const btnViewEmpty = $('btn-view-menu-cart');
  const countLabel   = $('cart-count-label');
  if (!container) return;

  const total = State.cart.reduce((s, i) => s + i.qty, 0);
  if (countLabel) countLabel.textContent = total > 0 ? `(${total})` : '';

  const show = el => { if (el) el.style.display = ''; };
  const hide = el => { if (el) el.style.display = 'none'; };

  if (State.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <svg width="80" height="80" fill="none" stroke="#9A8A6A" stroke-width="1.5" viewBox="0 0 24 24">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        <h3>${t('cart_empty')}</h3>
        <p>${t('cart_empty_sub')}</p>
      </div>`;
    [promoSec, formSec, summarySec, btnWa, btnClear].forEach(hide);
    show(btnViewEmpty);
    return;
  }

  // Has items
  [promoSec, formSec, summarySec, btnWa, btnClear].forEach(show);
  hide(btnViewEmpty);

  // Build item list
  const frag = document.createDocumentFragment();
  State.cart.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img class="cart-item-img" src="${escHtml(item.image)}" alt="${escHtml(loc(item.name))}" loading="lazy">
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(loc(item.name))}</div>
        <div class="cart-item-price">${item.qty * item.price} MAD</div>
        <div class="cart-item-controls">
          <div class="qty-controls">
            <button class="qty-btn js-cart-dec" aria-label="Réduire">−</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn js-cart-inc" aria-label="Augmenter">+</button>
          </div>
        </div>
      </div>
      <button class="cart-remove js-cart-remove" aria-label="Retirer">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
        </svg>
      </button>`;

    div.querySelector('.js-cart-dec').addEventListener('click', () => updateCartQty(item.id, -1));
    div.querySelector('.js-cart-inc').addEventListener('click', () => updateCartQty(item.id,  1));
    div.querySelector('.js-cart-remove').addEventListener('click', () => removeFromCart(item.id));
    frag.appendChild(div);
  });
  container.innerHTML = '';
  container.appendChild(frag);

  // Update summary
  const subtotal = State.cart.reduce((s, i) => s + i.qty * i.price, 0);
  const subEl = $('summary-subtotal');
  const totEl = $('summary-total');
  if (subEl) subEl.textContent = `${subtotal} MAD`;
  if (totEl) totEl.textContent = `${subtotal} MAD`;
}

/* ============================================================
   WHATSAPP ORDER
   ============================================================ */
function sendWhatsAppOrder() {
  const nameEl  = $('customer-name');
  const phoneEl = $('customer-phone');
  const addrEl  = $('customer-address');
  const noteEl  = $('order-notes');

  const name  = (nameEl?.value  ?? '').trim();
  const phone = (phoneEl?.value ?? '').trim().replace(/\s/g, '');
  const addr  = (addrEl?.value  ?? '').trim() || 'Sur place';
  const notes = (noteEl?.value  ?? '').trim() || '—';

  clearFieldErrors();
  let valid = true;

  if (!name) {
    showFieldError('customer-name', 'err-name', t('error_name'));
    valid = false;
  }
  if (!/^0[67]\d{8}$/.test(phone)) {
    showFieldError('customer-phone', 'err-phone', t('error_phone'));
    valid = false;
  }
  if (State.cart.length === 0) {
    showToast(t('error_empty_cart'), 'error');
    return;
  }
  if (!valid) return;

  const lines = State.cart.map(i =>
    `• ${loc(i.name)} x${i.qty} = ${i.qty * i.price} MAD`
  ).join('\n');
  const total = State.cart.reduce((s, i) => s + i.qty * i.price, 0);

  const msg = [
    `🍽️ *Nouvelle Commande — Snack El Idrissi*`,
    ``,
    `👤 *Nom :* ${name}`,
    `📱 *Téléphone :* ${phone}`,
    `📍 *Adresse :* ${addr}`,
    ``,
    `🛒 *Commande :*`,
    lines,
    `──────────────────`,
    `💰 *Total : ${total} MAD*`,
    ``,
    `📝 *Notes :* ${notes}`,
    ``,
    `Merci ! ✨`,
  ].join('\n');

  const wa = State.data?.restaurant?.whatsapp ?? '212688728284';
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
}

function showFieldError(inputId, errId, msg) {
  const inp = $(inputId);
  const err = $(errId);
  if (inp) {
    inp.classList.add('error');
    // remove class after animation ends
    inp.addEventListener('animationend', () => inp.classList.remove('error'), { once: true });
  }
  if (err) err.textContent = msg;
}

function clearFieldErrors() {
  ['customer-name', 'customer-phone'].forEach(id => $(id)?.classList.remove('error'));
  ['err-name', 'err-phone'].forEach(id => { const el = $(id); if (el) el.textContent = ''; });
}

/* ============================================================
   FLY-TO-CART ANIMATION
   ============================================================ */
function flyToCart(imgEl) {
  const cartBtn = document.querySelector('.cart-btn');
  if (!cartBtn || !imgEl || typeof imgEl.animate !== 'function') return;

  const src = imgEl.getBoundingClientRect();
  const dst = cartBtn.getBoundingClientRect();
  const SIZE = 48;

  const fly = document.createElement('img');
  fly.className = 'fly-item';
  fly.src = imgEl.src;
  fly.style.cssText = `
    width:${SIZE}px; height:${SIZE}px;
    left:${src.left + src.width  / 2 - SIZE / 2}px;
    top :${src.top  + src.height / 2 - SIZE / 2}px;
  `;
  document.body.appendChild(fly);

  const tx = (dst.left + dst.width  / 2) - (src.left + src.width  / 2);
  const ty = (dst.top  + dst.height / 2) - (src.top  + src.height / 2);

  const anim = fly.animate([
    { transform: 'translate(0,0) scale(1)',                  opacity: 1   },
    { transform: `translate(${tx*.5}px,${ty-50}px) scale(.5)`, opacity: .85, offset: .5 },
    { transform: `translate(${tx}px,${ty}px) scale(.1)`,    opacity: 0   },
  ], { duration: 640, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });

  anim.onfinish = () => {
    fly.remove();
    const badge = $('cart-badge');
    if (badge) { badge.classList.add('bounce'); setTimeout(() => badge.classList.remove('bounce'), 400); }
  };
}

/* ============================================================
   GALLERY
   ============================================================ */
function renderGallery() {
  const grid = $('gallery-grid');
  if (!grid || !State.data) return;

  const frag = document.createDocumentFragment();
  State.data.gallery.forEach((img, idx) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
      <img src="${escHtml(img.url)}" alt="${escHtml(loc(img.alt))}" loading="lazy">
      <div class="gallery-overlay" aria-hidden="true">
        <svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </div>`;
    item.addEventListener('click', () => openLightbox(idx));
    frag.appendChild(item);
  });
  grid.appendChild(frag);
}

/* ============================================================
   LIGHTBOX
   ============================================================ */
function openLightbox(idx) {
  State.lightboxIdx = idx;
  const lb  = $('lightbox');
  const img = $('lightbox-img');
  if (!lb || !img || !State.data) return;

  const entry = State.data.gallery[idx];
  img.src = entry.url;
  img.alt = loc(entry.alt);
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  $('lightbox')?.classList.remove('open');
  document.body.style.overflow = '';
}

function lightboxNav(dir) {
  const total = State.data?.gallery.length ?? 0;
  if (!total) return;
  State.lightboxIdx = (State.lightboxIdx + dir + total) % total;
  const img   = $('lightbox-img');
  const entry = State.data.gallery[State.lightboxIdx];
  if (img && entry) { img.src = entry.url; img.alt = loc(entry.alt); }
}

/* ============================================================
   TESTIMONIALS CAROUSEL
   ============================================================ */
function renderTestimonials() {
  const track = $('testimonial-track');
  const dots  = $('carousel-dots');
  if (!track || !State.data) return;

  const { testimonials } = State.data;
  const frag = document.createDocumentFragment();

  testimonials.forEach(item => {
    const slide = document.createElement('div');
    slide.className = 'testimonial-slide';
    const stars = '★'.repeat(item.stars) + '☆'.repeat(5 - item.stars);
    slide.innerHTML = `
      <div class="testimonial-card">
        <div class="testimonial-quote" aria-hidden="true">"</div>
        <div class="testimonial-stars" aria-label="${item.stars} étoiles">${stars}</div>
        <p class="testimonial-text">${escHtml(loc(item.text))}</p>
        <div class="testimonial-author">
          <div class="author-avatar" aria-hidden="true">${escHtml(item.name.charAt(0))}</div>
          <div>
            <div class="author-name">${escHtml(item.name)} <span aria-hidden="true">${item.flag}</span></div>
            <div class="author-meta">${escHtml(item.date)}</div>
          </div>
        </div>
      </div>`;
    frag.appendChild(slide);
  });

  track.innerHTML = '';
  track.appendChild(frag);

  if (dots) {
    dots.innerHTML = '';
    testimonials.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.className = `carousel-dot${idx === State.carouselIdx ? ' active' : ''}`;
      dot.setAttribute('aria-label', `Avis ${idx + 1}`);
      dot.addEventListener('click', () => { State.carouselIdx = idx; moveToSlide(); });
      dots.appendChild(dot);
    });
  }
  moveToSlide();
}

function moveToSlide() {
  const track = $('testimonial-track');
  if (track) track.style.transform = `translateX(-${State.carouselIdx * 100}%)`;
  $$('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === State.carouselIdx));
}

function moveCarousel(dir) {
  const total = State.data?.testimonials.length ?? 1;
  State.carouselIdx = (State.carouselIdx + dir + total) % total;
  moveToSlide();
  resetCarouselTimer();
}

function startCarouselTimer() {
  State.carouselTimer = setInterval(() => moveCarousel(1), 4200);
}
function resetCarouselTimer() {
  clearInterval(State.carouselTimer);
  startCarouselTimer();
}

/* ============================================================
   INFO BAND (dynamic render from data)
   ============================================================ */
function renderInfoBand() {
  const { restaurant } = State.data;

  // Hours
  const hoursEl = $('info-hours-rows');
  if (hoursEl) {
    hoursEl.innerHTML = restaurant.hours.map(h =>
      `<div class="info-row">
         <span class="day">${escHtml(loc(h.days))}</span>
         <span class="hours">${escHtml(h.time)}</span>
       </div>`
    ).join('');
  }

  // Address
  const addrEl = $('info-address');
  if (addrEl) addrEl.textContent = loc(restaurant.address);

  // Maps link
  const mapsEl = $('info-maps-link');
  if (mapsEl) mapsEl.href = restaurant.mapsUrl.startsWith('!') ? '#' : '#'; // iframe url, just keep link as-is

  // Map iframe
  const mapFrame = $('map-iframe');
  if (mapFrame) mapFrame.src = restaurant.mapsUrl;

  // Phone link
  const phoneEl = $('info-phone');
  if (phoneEl) {
    phoneEl.href        = `tel:${restaurant.phone}`;
    phoneEl.textContent = restaurant.phone.replace('+212', '0').replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }

  // WhatsApp link (header float + info band)
  $$('.wa-link').forEach(el => { el.href = `https://wa.me/${restaurant.whatsapp}`; });

  // Social
  const socIG = $('social-ig');
  const socFB = $('social-fb');
  const socGM = $('social-gm');
  if (socIG) socIG.href = restaurant.social.instagram;
  if (socFB) socFB.href = restaurant.social.facebook;
  if (socGM) socGM.href = restaurant.social.maps;
}

/* ============================================================
   STATS (fill from data)
   ============================================================ */
function fillStats() {
  const r = State.data.restaurant;
  const map = {
    'stat-reviews':  r.reviewCount,
    'stat-rating':   r.rating,
    'stat-price':    r.avgPrice,
    'stat-founded':  r.foundedYear,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = $(id);
    if (el) {
      el.dataset.count   = val;
      el.dataset.decimal = String(val).includes('.') ? '1' : '0';
      el.textContent     = '0';
    }
  });
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, type = 'success') {
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span aria-hidden="true">${icon}</span><span>${escHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 320);
  }, 3200);
}

/* ============================================================
   COOKIE BANNER
   ============================================================ */
function initCookieBanner() {
  if (lsGet('cookieAccepted', false)) { $('cookie-banner')?.remove(); return; }
}
function acceptCookie() { lsSet('cookieAccepted', true); hideCookieBanner(); }
function declineCookie() { hideCookieBanner(); }
function hideCookieBanner() {
  const b = $('cookie-banner');
  if (!b) return;
  b.classList.add('hidden');
  setTimeout(() => b.remove(), 340);
}

/* ============================================================
   KEYBOARD & GLOBAL EVENTS
   ============================================================ */
function initGlobalEvents() {
  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLightbox(); closeCart(); closeMobileMenu(); }
    if ($('lightbox')?.classList.contains('open')) {
      if (e.key === 'ArrowLeft')  lightboxNav(-1);
      if (e.key === 'ArrowRight') lightboxNav( 1);
    }
  });

  // Lightbox touch swipe
  const lb = $('lightbox');
  if (lb) {
    lb.addEventListener('touchstart', e => { State.lbTouchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend',   e => {
      const d = State.lbTouchX - e.changedTouches[0].clientX;
      if (Math.abs(d) > 55) lightboxNav(d > 0 ? 1 : -1);
    }, { passive: true });
    lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  }

  // Carousel touch swipe + pause on hover
  const carousel = $('testimonial-carousel');
  if (carousel) {
    carousel.addEventListener('touchstart', e => { State.carTouchX = e.touches[0].clientX; clearInterval(State.carouselTimer); }, { passive: true });
    carousel.addEventListener('touchend',   e => {
      const d = State.carTouchX - e.changedTouches[0].clientX;
      if (Math.abs(d) > 55) moveCarousel(d > 0 ? 1 : -1);
      startCarouselTimer();
    }, { passive: true });
    carousel.addEventListener('mouseenter', () => clearInterval(State.carouselTimer));
    carousel.addEventListener('mouseleave', startCarouselTimer);
  }

  // Search input
  $('search-input')?.addEventListener('input', onSearchInput);

  // Cart overlay click-outside
  $('cart-overlay')?.addEventListener('click', closeCart);
}

/* ============================================================
   EXPOSE GLOBAL HANDLERS (called from HTML attributes)
   ============================================================ */
Object.assign(window, {
  setLanguage,
  toggleMobileMenu,
  closeMobileMenu,
  openCart,
  closeCart,
  clearCart,
  clearSearch,
  sendWhatsAppOrder,
  closeLightbox,
  lightboxNav,
  moveCarousel,
  acceptCookie,
  declineCookie,
  // Scroll-arrow click
  scrollToStats: () => $('stats')?.scrollIntoView({ behavior: 'smooth' }),
  scrollToMenu:  () => $('menu')?.scrollIntoView({ behavior: 'smooth' }),
  scrollToTop:   () => window.scrollTo({ top: 0, behavior: 'smooth' }),
});

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  // 1. Read persisted preferences
  State.lang = lsGet('lang', 'fr');
  State.cart = lsGet('cart', []);

  // 2. Start loader animation immediately (no data needed)
  initLoader();

  // 3. Fetch data
  try {
    await loadData();
  } catch (err) {
    console.error('[Snack El Idrissi] Failed to load data.json:', err);
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#C9A84C;background:#08070A;flex-direction:column;gap:16px">
      <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p>Impossible de charger les données. Vérifiez que <code>data.json</code> est accessible.</p>
    </div>`;
    return;
  }

  // 4. Apply language (no render yet — we render below)
  setLanguage(State.lang, true);

  // 5. Fill dynamic data
  fillStats();
  renderInfoBand();

  // 6. Render sections
  renderMenu();
  renderGallery();
  renderTestimonials();
  updateCartBadge();

  // 7. Init behaviours
  initScrollEffects();
  initCounters();
  startCarouselTimer();
  initCookieBanner();
  initGlobalEvents();
}

document.addEventListener('DOMContentLoaded', boot);
