/**
 * app.js — Інтерфейс поточної карти сайту «Контролери для ЧПК»
 * - Меню категорій зліва (1-3 рівні), вибір категорій, таблиці товарів
 * - Елегантний живий пошук товарів та артикулів із підсвічуванням
 * - Повна адаптивність під мобільні та планшети
 */

(function () {
  'use strict';

  // ── СТАН ДОДАТКУ ──────────────────────────────────────────────────────────
  const state = {
    mode: 'selected',             // 'selected' (Дерево категорій) або 'all' (Суцільний список)
    selectedNodeId: 'node-1',     // ID поточної категорії ("Контролери для ЧПК")
    sidebarCollapsed: new Set(),  // Згорнуті вузли в лівому меню
    searchQuery: '',              // Рядок активного пошуку

    // Незалежний показ товарів для кожного рівня (Рівень 1, Рівень 2, Рівень 3)
    levelVisible: {
      1: true,
      2: true,
      3: true
    },
    // Індивідуальні перемикання для конкретних вузлів
    nodeOverrides: new Map()
  };

  let nodeMap = new Map();
  let parentMap = new Map();
  let allNodes = [];

  // Підрахунок товарів за рівнями
  const levelCounts = { 1: 0, 2: 0, 3: 0 };

  // ── ІНІЦІАЛІЗАЦІЯ ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.CATALOG_DATA || !window.CATALOG_DATA.tree) {
      document.getElementById('content-body').innerHTML = `
        <div class="empty-note" style="color: red;">
          Не вдалося завантажити data.js. Перевірте наявність файлу.
        </div>
      `;
      return;
    }

    indexTree(window.CATALOG_DATA.tree, null);
    initTheme();
    renderSidebar();
    renderContent();
    setupEvents();
  });

  // ── ІНДЕКСАЦІЯ ВУЗЛІВ ─────────────────────────────────────────────────────
  function indexTree(node, parent) {
    nodeMap.set(node.id, node);
    allNodes.push(node);
    if (parent) parentMap.set(node.id, parent);

    const prodsCount = node.own_products ? node.own_products.length : 0;
    levelCounts[node.level] = (levelCounts[node.level] || 0) + prodsCount;

    if (node.children) {
      node.children.forEach(child => indexTree(child, node));
    }
  }

  function getPath(node) {
    const path = [];
    let curr = node;
    while (curr) {
      path.unshift(curr);
      curr = parentMap.get(curr.id);
    }
    return path;
  }

  function isNodeProductsVisible(node) {
    if (state.nodeOverrides.has(node.id)) {
      return state.nodeOverrides.get(node.id);
    }
    return Boolean(state.levelVisible[node.level]);
  }

  // ── ЛІВЕ МЕНЮ КАТЕГОРІЙ (SIDEBAR) ─────────────────────────────────────────
  function renderSidebar() {
    const container = document.getElementById('category-tree');
    container.innerHTML = '';

    const q = state.searchQuery.trim().toLowerCase();

    function createSidebarNode(node) {
      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = state.sidebarCollapsed.has(node.id);
      const isActive = !q && state.mode === 'selected' && state.selectedNodeId === node.id;

      // Підрахунок збігів пошуку в даному вузлі
      let matchesInNode = 0;
      let hasMatchesInBranch = false;

      if (q) {
        const prods = node.own_products || [];
        matchesInNode = prods.filter(p => 
          p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))
        ).length;
        if (node.name.toLowerCase().includes(q)) {
          matchesInNode++;
        }
        hasMatchesInBranch = nodeHasSearchMatch(node, q);
      }

      const nodeEl = document.createElement('div');
      nodeEl.className = `nav-node lvl-${node.level}`;

      // Рядок категорії
      const row = document.createElement('div');
      let rowClass = `nav-row ${isActive ? 'active' : ''}`;
      if (q) {
        if (matchesInNode > 0) {
          rowClass += ' has-search-match';
        } else if (!hasMatchesInBranch) {
          rowClass += ' search-dimmed';
        }
      }
      row.className = rowClass;

      // Стрілка для згортання
      const arrow = document.createElement('span');
      arrow.className = `arrow ${hasChildren ? (isCollapsed ? 'closed' : 'open') : 'empty'}`;
      arrow.textContent = hasChildren ? '▼' : '';
      if (hasChildren) {
        arrow.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.sidebarCollapsed.has(node.id)) {
            state.sidebarCollapsed.delete(node.id);
          } else {
            state.sidebarCollapsed.add(node.id);
          }
          renderSidebar();
        });
      }
      row.appendChild(arrow);

      // Назва категорії
      const title = document.createElement('span');
      title.className = 'node-title';
      title.innerHTML = q ? highlightText(node.name, q) : escapeHtml(node.name);
      title.title = node.name;
      row.appendChild(title);

      // Бейдж збігів пошуку або звичайна кількість товарів
      if (q && matchesInNode > 0) {
        const matchBadge = document.createElement('span');
        matchBadge.className = 'nav-match-badge';
        matchBadge.textContent = `${matchesInNode}`;
        matchBadge.title = `Знайдено ${matchesInNode} збігів`;
        row.appendChild(matchBadge);
      } else {
        const count = document.createElement('span');
        count.className = 'node-count';
        count.textContent = `(${node.stats.own_products || 0})`;
        row.appendChild(count);
      }

      // Клік обирає категорію
      row.addEventListener('click', () => {
        // Якщо пошук був активний, клік по категорії очищує пошук і фокусується на обраній
        if (state.searchQuery) {
          clearSearch(false);
        }
        state.selectedNodeId = node.id;
        state.mode = 'selected';
        closeMobileSidebar();
        updateTabsUI();
        renderSidebar();
        renderContent();
      });

      nodeEl.appendChild(row);

      // Дочірні категорії
      if (hasChildren) {
        const childrenBox = document.createElement('div');
        // Якщо пошук активний і в гілці є збіги — авторозгортаємо
        const shouldBeOpen = q ? hasMatchesInBranch : !isCollapsed;
        childrenBox.className = `nav-children ${shouldBeOpen ? '' : 'hidden'}`;
        node.children.forEach(child => {
          childrenBox.appendChild(createSidebarNode(child));
        });
        nodeEl.appendChild(childrenBox);
      }

      return nodeEl;
    }

    container.appendChild(createSidebarNode(window.CATALOG_DATA.tree));
  }

  function nodeHasSearchMatch(node, q) {
    if (node.name.toLowerCase().includes(q)) return true;
    if (node.own_products && node.own_products.some(p => 
      p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))
    )) return true;
    if (node.children) return node.children.some(ch => nodeHasSearchMatch(ch, q));
    return false;
  }

  function updateTabsUI() {
    const tabAll = document.getElementById('tab-all');
    const tabSel = document.getElementById('tab-selected');
    if (state.mode === 'all') {
      tabAll.classList.add('active');
      tabSel.classList.remove('active');
    } else {
      tabSel.classList.add('active');
      tabAll.classList.remove('active');
    }
  }

  // ── ОСНОВНИЙ ВМІСТ (ПРАВА ЧАСТИНА) ────────────────────────────────────────
  function renderContent() {
    const body = document.getElementById('content-body');
    body.innerHTML = '';

    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      renderSearchView(q, body);
      return;
    }

    const selNode = nodeMap.get(state.selectedNodeId) || window.CATALOG_DATA.tree;
    updateHeader(selNode);

    if (state.mode === 'selected') {
      renderSingleView(selNode, body);
    } else {
      renderAllView(body);
    }
  }

  function updateHeader(node) {
    const bc = document.getElementById('breadcrumbs');
    const badge = document.getElementById('cat-level-badge');
    const heading = document.getElementById('cat-heading');
    const siteLink = document.getElementById('cat-site-link');
    const toggleBar = document.getElementById('level-toggles-bar');

    if (state.searchQuery.trim()) {
      bc.innerHTML = `
        <span class="crumb-link" data-id="root">Каталог</span>
        <span class="sep">/</span>
        <span class="crumb-current">Пошук: «${escapeHtml(state.searchQuery)}»</span>
      `;
      bc.querySelector('.crumb-link').addEventListener('click', () => clearSearch());
      badge.textContent = 'Пошук';
      heading.textContent = `Результати пошуку для «${state.searchQuery}»`;
      siteLink.style.display = 'none';
      if (toggleBar) toggleBar.style.display = 'none';
      return;
    }

    siteLink.style.display = 'inline-flex';

    if (state.mode === 'all') {
      bc.innerHTML = `<span>Каталог</span> <span class="sep">/</span> <span class="crumb-current">Суцільний список (усі рівні)</span>`;
      badge.textContent = 'Огляд';
      heading.textContent = 'Суцільний список категорій та товарів';
      siteLink.href = window.CATALOG_DATA.tree.url;

      if (toggleBar) {
        toggleBar.style.display = 'flex';
        updateLevelTogglesUI();
      }
    } else {
      const path = getPath(node);
      bc.innerHTML = `
        <span class="crumb-link" data-id="root">Каталог</span>
        ${path.map((p, idx) => `
          <span class="sep">/</span>
          <span class="${idx === path.length - 1 ? 'crumb-current' : 'crumb-link'}" data-id="${p.id}">${p.name}</span>
        `).join('')}
      `;

      bc.querySelectorAll('.crumb-link').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.id === 'root' ? window.CATALOG_DATA.tree.id : el.dataset.id;
          state.selectedNodeId = id;
          state.mode = 'selected';
          updateTabsUI();
          renderSidebar();
          renderContent();
        });
      });

      badge.textContent = `Рівень ${node.level}`;
      heading.textContent = node.name;
      siteLink.href = node.url || '#';

      if (toggleBar) {
        toggleBar.style.display = 'none';
      }
    }
  }

  function updateLevelTogglesUI() {
    [1, 2, 3].forEach(lvl => {
      const btn = document.getElementById(`btn-toggle-lvl-${lvl}`);
      if (btn) {
        const isVis = state.levelVisible[lvl];
        const statusSpan = btn.querySelector('.status-text');
        if (isVis) {
          btn.classList.add('active');
          if (statusSpan) statusSpan.textContent = 'Показано';
        } else {
          btn.classList.remove('active');
          if (statusSpan) statusSpan.textContent = 'Приховано';
        }
      }
    });
  }

  // ── РЕЖИМ 1: ОБРАНИЙ РОЗДІЛ ───────────────────────────────────────────────
  function renderSingleView(node, container) {
    const hasChildren = node.children && node.children.length > 0;
    const hasOwnProds = node.own_products && node.own_products.length > 0;

    // Якщо це корінь і є підкатегорії
    if (node.level === 1 && hasChildren) {
      const subcatsSection = document.createElement('div');
      subcatsSection.className = 'section-block';
      subcatsSection.innerHTML = `
        <div class="section-title">
          <span>Підкатегорії розділу (${node.children.length})</span>
        </div>
      `;
      const grid = document.createElement('div');
      grid.className = 'subcats-grid';
      node.children.forEach(child => {
        const card = document.createElement('div');
        card.className = 'subcat-card';
        card.innerHTML = `
          <div class="subcat-name">${child.name}</div>
          <div class="subcat-meta">
            <span>${child.children ? child.children.length : 0} підкат.</span>
            <span>•</span>
            <span>${child.stats ? child.stats.total_products : (child.own_products ? child.own_products.length : 0)} тов.</span>
          </div>
        `;
        card.addEventListener('click', () => {
          state.selectedNodeId = child.id;
          state.sidebarCollapsed.delete(node.id);
          renderSidebar();
          renderContent();
        });
        grid.appendChild(card);
      });
      subcatsSection.appendChild(grid);
      container.appendChild(subcatsSection);
    }

    // Якщо є власні товари
    if (hasOwnProds) {
      const prodsSection = document.createElement('div');
      prodsSection.className = 'section-block';

      const label = (node.level === 1 && hasChildren) 
        ? `Товари на 1 рівні (поза підкатегоріями) — ${node.own_products.length} шт.`
        : (hasChildren ? `Товари категорії (поза підкатегоріями) — ${node.own_products.length} шт.` : `Товари категорії (${node.own_products.length} шт.)`);

      prodsSection.innerHTML = `
        <div class="section-title">
          <span>${label}</span>
        </div>
      `;
      prodsSection.appendChild(buildTable(node.own_products));
      container.appendChild(prodsSection);
    }

    // Якщо це категорія 2 рівня із підкатегоріями 3 рівня
    if (node.level === 2 && hasChildren) {
      node.children.forEach(sub => {
        const subSec = document.createElement('div');
        subSec.className = 'section-block';
        const subProds = sub.own_products || [];

        const titleDiv = document.createElement('div');
        titleDiv.className = 'section-title';
        titleDiv.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="level-tag l3">Рівень 3</span>
            <span style="font-weight: 600;">${sub.name}</span>
            <span style="font-weight: normal; color: var(--text-muted); font-size: 0.8rem;">(${subProds.length} тов.)</span>
          </div>
          <div>
            ${sub.url ? `<a href="${sub.url}" target="_blank" rel="noopener noreferrer" class="link-site">на сайті ↗</a>` : ''}
          </div>
        `;
        subSec.appendChild(titleDiv);

        if (subProds.length > 0) {
          subSec.appendChild(buildTable(subProds));
        } else {
          subSec.innerHTML += `<div class="empty-note">У цій підкатегорії немає товарів</div>`;
        }
        container.appendChild(subSec);
      });
    }

    if (!hasOwnProds && !hasChildren) {
      container.innerHTML = `<div class="empty-note">У цій категорії немає товарів та підкатегорій.</div>`;
    }
  }

  // ── РЕЖИМ 2: СУЦІЛЬНИЙ СПИСОК ─────────────────────────────────────────────
  function renderAllView(container) {
    allNodes.forEach(node => {
      const prods = node.own_products || [];
      if (prods.length === 0) return;

      const isVisible = isNodeProductsVisible(node);
      const isOverridden = state.nodeOverrides.has(node.id);

      const sec = document.createElement('div');
      sec.className = `all-cat-section lvl-${node.level}`;

      const hdr = document.createElement('div');
      hdr.className = 'all-cat-header';

      const path = getPath(node);
      const pathText = path.map(p => p.name).join(' › ');

      hdr.innerHTML = `
        <div class="all-cat-title-wrap">
          <span class="level-tag l${node.level}">Рівень ${node.level}</span>
          <span class="all-cat-name">${node.name}</span>
          <span class="all-cat-path">${pathText}</span>
        </div>
        <div class="all-cat-meta">
          <span class="all-cat-count">${prods.length} тов.</span>
          <button class="btn-toggle-node ${isVisible ? 'active' : ''}" title="Показати/приховати товари цієї категорії">
            ${isVisible ? 'Приховати' : 'Показати'}
          </button>
        </div>
      `;

      const btnToggle = hdr.querySelector('.btn-toggle-node');
      btnToggle.addEventListener('click', () => {
        state.nodeOverrides.set(node.id, !isVisible);
        renderContent();
      });

      sec.appendChild(hdr);

      if (isVisible) {
        sec.appendChild(buildTable(prods));
      }
      container.appendChild(sec);
    });
  }

  // ── РЕЖИМ 3: РЕЗУЛЬТАТИ ПОШУКУ ───────────────────────────────────────────
  function renderSearchView(q, container) {
    updateHeader(null);

    // Збір товарів зі збігами
    const matchesByNode = [];
    let totalMatches = 0;

    allNodes.forEach(node => {
      const prods = node.own_products || [];
      const matchingProds = prods.filter(p => 
        p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))
      );

      if (matchingProds.length > 0) {
        matchesByNode.push({ node, products: matchingProds });
        totalMatches += matchingProds.length;
      }
    });

    // Оновлюємо бейдж кількості в шапці
    updateSearchBadge(totalMatches);

    // Банер результатів пошуку
    const banner = document.createElement('div');
    banner.className = 'search-results-banner';
    banner.innerHTML = `
      <div class="search-results-info">
        За запитом «<b>${escapeHtml(state.searchQuery)}</b>» знайдено: <b>${totalMatches}</b> товарів у <b>${matchesByNode.length}</b> категоріях
      </div>
      <button class="btn-reset-search" id="btn-banner-clear">✕ Скинути пошук (Esc)</button>
    `;
    banner.querySelector('#btn-banner-clear').addEventListener('click', () => clearSearch());
    container.appendChild(banner);

    if (totalMatches === 0) {
      container.innerHTML += `
        <div class="empty-note" style="padding: 40px 16px; font-size: 0.95rem;">
          Нічого не знайдено за запитом «<b>${escapeHtml(state.searchQuery)}</b>».<br>
          Спробуйте ввести частину назви або артикул (наприклад: <code>05-016</code>, <code>Mach3</code>, <code>MESA</code>).
        </div>
      `;
      return;
    }

    // Виведення результатів, згрупованих за категоріями
    matchesByNode.forEach(item => {
      const { node, products } = item;
      const sec = document.createElement('div');
      sec.className = `all-cat-section lvl-${node.level}`;

      const path = getPath(node);
      const pathText = path.map(p => p.name).join(' › ');

      const hdr = document.createElement('div');
      hdr.className = 'all-cat-header';
      hdr.innerHTML = `
        <div class="all-cat-title-wrap">
          <span class="level-tag l${node.level}">Рівень ${node.level}</span>
          <span class="all-cat-name">${highlightText(node.name, q)}</span>
          <span class="all-cat-path">${pathText}</span>
        </div>
        <div class="all-cat-meta">
          <span class="all-cat-count">${products.length} знайдено</span>
          <button class="btn-cat-select" title="Відкрити цю категорію в каталозі">
            Перейти в розділ →
          </button>
        </div>
      `;

      hdr.querySelector('.btn-cat-select').addEventListener('click', () => {
        clearSearch(false);
        state.selectedNodeId = node.id;
        state.mode = 'selected';
        updateTabsUI();
        renderSidebar();
        renderContent();
      });

      sec.appendChild(hdr);
      sec.appendChild(buildTable(products, q));
      container.appendChild(sec);
    });
  }

  function updateSearchBadge(count) {
    const badge = document.getElementById('search-count-badge');
    const clearBtn = document.getElementById('search-clear');
    if (!badge || !clearBtn) return;

    if (state.searchQuery.trim()) {
      clearBtn.style.display = 'block';
      badge.style.display = 'inline-block';
      badge.textContent = `${count} знайдено`;
    } else {
      clearBtn.style.display = 'none';
      badge.style.display = 'none';
    }
  }

  function clearSearch(renderAfter = true) {
    state.searchQuery = '';
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    updateSearchBadge(0);

    if (renderAfter) {
      renderSidebar();
      renderContent();
    }
  }

  // ── ПОБУДОВА ТАБЛИЦІ ТОВАРІВ ───────────────────────────────────────────────
  function buildTable(products, query = '') {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';

    const table = document.createElement('table');
    table.className = 'data-table';

    const rows = products.map((p, idx) => {
      const isYes = p.availability && p.availability.toLowerCase().includes('в наявності');
      const codeHtml = p.code ? (query ? highlightText(p.code, query) : escapeHtml(p.code)) : '—';
      const nameHtml = query ? highlightText(p.name, query) : escapeHtml(p.name);

      return `
        <tr>
          <td class="col-n">${p.index || (idx + 1)}</td>
          <td class="col-code">${codeHtml}</td>
          <td class="col-name">
            ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer">${nameHtml}</a>` : nameHtml}
          </td>
          <td class="col-avail">
            <span class="${isYes ? 'badge-yes' : 'badge-no'}">${escapeHtml(p.availability || '—')}</span>
          </td>
        </tr>
      `;
    }).join('');

    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-n">№</th>
          <th class="col-code">Код</th>
          <th>Назва товару</th>
          <th class="col-avail">Наявність</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    `;

    wrap.appendChild(table);
    return wrap;
  }

  // ── МОБІЛЬНЕ МЕНЮ (DRAWER) ────────────────────────────────────────────────
  function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
      closeMobileSidebar();
    } else {
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('active');
    }
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  // ── ОБРОБКА ПОДІЙ ТА КЛАВІАТУРИ ───────────────────────────────────────────
  function setupEvents() {
    // Вкладки режиму перегляду
    document.getElementById('tab-selected').addEventListener('click', () => {
      state.mode = 'selected';
      clearSearch(false);
      updateTabsUI();
      renderSidebar();
      renderContent();
    });

    document.getElementById('tab-all').addEventListener('click', () => {
      state.mode = 'all';
      clearSearch(false);
      updateTabsUI();
      renderSidebar();
      renderContent();
    });

    // Кнопки бічної панелі: розгорнути / згорнути всі
    document.getElementById('btn-expand-all').addEventListener('click', () => {
      state.sidebarCollapsed.clear();
      renderSidebar();
    });

    document.getElementById('btn-collapse-all').addEventListener('click', () => {
      allNodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          state.sidebarCollapsed.add(n.id);
        }
      });
      renderSidebar();
    });

    // Незалежні кнопки рівнів для суцільного списку
    [1, 2, 3].forEach(lvl => {
      const btn = document.getElementById(`btn-toggle-lvl-${lvl}`);
      if (btn) {
        btn.addEventListener('click', () => {
          state.levelVisible[lvl] = !state.levelVisible[lvl];
          allNodes.forEach(n => {
            if (n.level === lvl) {
              state.nodeOverrides.delete(n.id);
            }
          });
          updateLevelTogglesUI();
          renderContent();
        });
      }
    });

    // Пошук
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderSidebar();
        renderContent();
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          clearSearch();
          searchInput.blur();
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        clearSearch();
        if (searchInput) searchInput.focus();
      });
    }

    // Мобільне меню
    const mobileBtn = document.getElementById('btn-mobile-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (mobileBtn) mobileBtn.addEventListener('click', toggleMobileSidebar);
    if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);

    // Гарячі клавіші (Ctrl+K та /)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        if (searchInput) {
          searchInput.focus();
        }
      }
    });

    // Перемикач теми
    const btnTheme = document.getElementById('btn-theme-toggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', toggleTheme);
    }
  }

  // ── ТЕМА ОФОРМЛЕННЯ (СВІТЛА / ТЕМНА) ───────────────────────────────────────
  function initTheme() {
    let currentTheme = 'light';
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        currentTheme = savedTheme;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        currentTheme = 'dark';
      }
    } catch (e) {}
    applyTheme(currentTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
    updateThemeButtonUI(theme);
  }

  function updateThemeButtonUI(theme) {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    if (theme === 'dark') {
      btn.innerHTML = `<span class="theme-icon">☀️</span> <span class="theme-text">Світла</span>`;
      btn.title = 'Перемкнути на світлу тему';
    } else {
      btn.innerHTML = `<span class="theme-icon">🌙</span> <span class="theme-text">Темна</span>`;
      btn.title = 'Перемкнути на темну тему';
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  // ── ДОПОМІЖНІ ФУНКЦІЇ ─────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function highlightText(text, query) {
    if (!text) return '';
    if (!query) return escapeHtml(text);

    const safeText = String(text);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return safeText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

})();
