/**
 * site_map / app_simple.js
 * Спрощений скрипт вертикального списку каталогу
 * - Підтримка тем (темна за замовчуванням / світла)
 * - Повна адаптивність (mobile / tablet / desktop)
 * - Живий пошук з підсвічуванням збігів, лічильником та гарячими клавішами
 * - Незалежне розгортання підкатегорій [+][-] та товарів
 */

(function () {
  'use strict';

  const state = {
    subcatsExpanded: new Set(),
    productsExpanded: new Set(),
    filterText: '',
    theme: 'dark'
  };

  let rootNode = null;
  let allNodes = [];

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.CATALOG_DATA || !window.CATALOG_DATA.tree) {
      document.getElementById('tree').innerHTML = '<div style="color:red; padding:16px;">Дані каталогу не знайдено (data.js). Перевірте наявність файлу.</div>';
      return;
    }

    rootNode = window.CATALOG_DATA.tree;
    indexNodes(rootNode);
    initTheme();
    resetToDefault();
    setupEvents();
  });

  // ── ТЕМА ОФОРМЛЕННЯ (ТЕМНА ЗА ЗАМОВЧУВАННЯМ) ──────────────────────────────
  function initTheme() {
    let savedTheme = 'dark';
    try {
      savedTheme = localStorage.getItem('theme_simple') || 'dark';
    } catch (e) {
      savedTheme = 'dark';
    }

    setTheme(savedTheme);

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const next = state.theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
      });
    }
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme_simple', theme);
    } catch (e) {}

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('.theme-icon');
      const label = toggleBtn.querySelector('.theme-label');
      if (theme === 'dark') {
        if (icon) icon.textContent = '🌙';
        if (label) label.textContent = 'Темна';
        toggleBtn.title = 'Перемкнути на світлу тему';
      } else {
        if (icon) icon.textContent = '☀️';
        if (label) label.textContent = 'Світла';
        toggleBtn.title = 'Перемкнути на темну тему';
      }
    }
  }

  // ── ІНДЕКСАЦІЯ ВУЗЛІВ ─────────────────────────────────────────────────────
  function indexNodes(node) {
    allNodes.push(node);
    if (node.children) {
      node.children.forEach(ch => indexNodes(ch));
    }
  }

  // За замовчуванням: всі категорії та підкатегорії розгорнуті, всі товари сховані
  function resetToDefault() {
    state.subcatsExpanded = new Set();
    state.productsExpanded = new Set();
    state.filterText = '';

    allNodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        state.subcatsExpanded.add(node.id);
      }
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    updateSearchControls();

    render();
  }

  // ── РЕНДЕРИНГ ─────────────────────────────────────────────────────────────
  function render() {
    const container = document.getElementById('tree');
    container.innerHTML = '';

    if (!rootNode) return;

    const q = state.filterText.trim().toLowerCase();
    if (q) {
      // Підрахунок знайденого
      let totalMatchingProds = 0;
      let matchingCatsCount = 0;

      allNodes.forEach(n => {
        const prods = n.own_products || [];
        const matches = prods.filter(p => 
          p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))
        );
        if (matches.length > 0) {
          totalMatchingProds += matches.length;
          matchingCatsCount++;
        } else if (n.name.toLowerCase().includes(q)) {
          matchingCatsCount++;
        }
      });

      const statsEl = document.getElementById('search-stats');
      if (statsEl) {
        statsEl.style.display = 'block';
        if (totalMatchingProds > 0 || matchingCatsCount > 0) {
          statsEl.innerHTML = `Знайдено: <b>${totalMatchingProds}</b> товарів у <b>${matchingCatsCount}</b> категоріях`;
        } else {
          statsEl.innerHTML = `Нічого не знайдено за запитом «<b>${escapeHtml(q)}</b>»`;
        }
      }

      const nodeEl = renderNode(rootNode);
      if (nodeEl && nodeEl.style.display !== 'none') {
        container.appendChild(nodeEl);
      } else {
        container.innerHTML = `
          <div class="empty-search-msg">
            За запитом «<b>${escapeHtml(q)}</b>» нічого не знайдено.<br>
            Спробуйте інший код товару (наприклад, <code>05-016</code>) або назву.
          </div>
        `;
      }
    } else {
      const statsEl = document.getElementById('search-stats');
      if (statsEl) statsEl.style.display = 'none';

      container.appendChild(renderNode(rootNode));
    }
  }

  function renderNode(node) {
    const hasChildren = node.children && node.children.length > 0;
    const prods = node.own_products || [];
    const hasProds = prods.length > 0;

    const isSubExpanded = state.subcatsExpanded.has(node.id);
    const isProdExpanded = state.productsExpanded.has(node.id);

    // Фільтрація по тексту
    const q = state.filterText.trim().toLowerCase();
    let filteredProds = prods;
    if (q) {
      const matchNode = node.name.toLowerCase().includes(q);
      filteredProds = prods.filter(p => 
        p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))
      );
      const matchProds = filteredProds.length > 0;
      const matchChildren = hasChildren && nodeHasMatch(node, q);
      if (!matchNode && !matchProds && !matchChildren) {
        const dummy = document.createElement('div');
        dummy.style.display = 'none';
        return dummy;
      }
    }

    const wrap = document.createElement('div');
    wrap.className = `tree-node lvl-${node.level}`;

    // Рядок категорії
    const row = document.createElement('div');
    row.className = 'node-row';

    // Кнопка [−] / [+] для підкатегорій
    const btnExp = document.createElement('button');
    btnExp.className = `btn-exp ${!hasChildren ? 'empty' : ''}`;
    btnExp.textContent = isSubExpanded ? '−' : '+';
    btnExp.title = isSubExpanded ? 'Згорнути підкатегорії' : 'Розгорнути підкатегорії';
    btnExp.setAttribute('aria-label', isSubExpanded ? 'Згорнути підкатегорії' : 'Розгорнути підкатегорії');
    btnExp.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!hasChildren) return;
      if (state.subcatsExpanded.has(node.id)) {
        state.subcatsExpanded.delete(node.id);
      } else {
        state.subcatsExpanded.add(node.id);
      }
      render();
    });
    row.appendChild(btnExp);

    // Бейдж рівня
    const badge = document.createElement('span');
    badge.className = `lvl-badge l${node.level}`;
    badge.textContent = `Рівень ${node.level}`;
    row.appendChild(badge);

    // Назва категорії
    const name = document.createElement('span');
    name.className = 'node-name';
    name.innerHTML = q ? highlightText(node.name, q) : escapeHtml(node.name);
    row.appendChild(name);

    // Посилання на сайт
    if (node.url) {
      const link = document.createElement('a');
      link.href = node.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'site-link';
      link.textContent = 'сайт ↗';
      link.addEventListener('click', (e) => e.stopPropagation());
      row.appendChild(link);
    }

    // Лічильники
    const counts = document.createElement('span');
    counts.className = 'node-counts';
    const totalCount = node.stats ? (node.stats.total_products || node.stats.own_products) : prods.length;
    counts.textContent = hasChildren ? `(${node.children.length} підкат. / ${totalCount} тов.)` : `(${totalCount} тов.)`;
    row.appendChild(counts);

    // Кнопка показу/приховання товарів цієї категорії
    const isOrphan = hasChildren;
    const labelText = isOrphan ? 'Товари поза підкатегоріями' : 'Товари категорії';

    if (hasProds) {
      const curProds = q ? filteredProds : prods;
      const outOfStockCount = curProds.filter(p => !p.availability || p.availability.toLowerCase().includes('немає')).length;

      const btnP = document.createElement('button');
      btnP.className = `btn-prods ${isOrphan ? 'orphan' : ''} ${isProdExpanded ? 'active' : ''}`;
      btnP.innerHTML = `
        <span class="btn-prods-label">${labelText}</span>
        <span class="btn-prods-counts">
          <span class="count-total">${curProds.length}</span>
          <span class="count-sep">/</span>
          <span class="count-no ${outOfStockCount === 0 ? 'zero' : ''}">${outOfStockCount} немає</span>
        </span>
        <span class="btn-prods-arrow">${isProdExpanded ? '▲' : '▼'}</span>
      `;
      btnP.title = isProdExpanded 
        ? `Приховати ${labelText.toLowerCase()} (${curProds.length} шт., з них ${outOfStockCount} немає)` 
        : `Показати ${labelText.toLowerCase()} (${curProds.length} шт., з них ${outOfStockCount} немає)`;

      btnP.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.productsExpanded.has(node.id)) {
          state.productsExpanded.delete(node.id);
        } else {
          state.productsExpanded.add(node.id);
        }
        render();
      });
      row.appendChild(btnP);
    } else {
      // Порожній стан для вирівнювання сітки на десктопі
      row.classList.add('no-prods');
      const btnP = document.createElement('div');
      btnP.className = `btn-prods empty ${isOrphan ? 'orphan' : ''}`;
      btnP.title = isOrphan 
        ? `Усі товари цієї категорії розподілені за підкатегоріями (0 товарів поза підкатегоріями)` 
        : `У цій категорії немає товарів`;
      btnP.innerHTML = `
        <span class="btn-prods-label">${labelText}</span>
        <span class="btn-prods-counts">
          <span class="count-total">0</span>
        </span>
        <span class="btn-prods-arrow">—</span>
      `;
      row.appendChild(btnP);
    }

    const labelForTitle = hasChildren ? 'товари поза підкатегоріями' : 'товари категорії';
    row.title = hasProds ? (isProdExpanded ? `Згорнути ${labelForTitle}` : `Розгорнути ${labelForTitle}`) : '';

    // Клік по рядку розгортає/згортає товари
    row.addEventListener('click', () => {
      if (hasProds) {
        if (state.productsExpanded.has(node.id)) {
          state.productsExpanded.delete(node.id);
        } else {
          state.productsExpanded.add(node.id);
        }
        render();
      }
    });

    wrap.appendChild(row);

    // Таблиця товарів (якщо розгорнуто)
    if (hasProds) {
      const prodsWrap = document.createElement('div');
      prodsWrap.className = `node-products ${isProdExpanded ? '' : 'hidden'}`;
      prodsWrap.appendChild(renderTable(filteredProds, q));
      wrap.appendChild(prodsWrap);
    }

    // Підкатегорії (якщо є і розгорнуто)
    if (hasChildren) {
      const childrenWrap = document.createElement('div');
      childrenWrap.className = `node-children ${isSubExpanded ? '' : 'hidden'}`;
      node.children.forEach(ch => {
        childrenWrap.appendChild(renderNode(ch));
      });
      wrap.appendChild(childrenWrap);
    }

    return wrap;
  }

  function nodeHasMatch(node, q) {
    if (node.name.toLowerCase().includes(q)) return true;
    if (node.own_products && node.own_products.some(p => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q)))) return true;
    if (node.children) return node.children.some(ch => nodeHasMatch(ch, q));
    return false;
  }

  function renderTable(products, q) {
    const table = document.createElement('table');
    table.className = 'table-prods';

    if (!products || products.length === 0) {
      table.innerHTML = '<tr><td style="padding:10px; color:var(--text-muted);">Товарів не знайдено</td></tr>';
      return table;
    }

    const rows = products.map((p, idx) => {
      const isYes = p.availability && p.availability.toLowerCase().includes('в наявності');
      const codeHtml = p.code ? (q ? highlightText(p.code, q) : escapeHtml(p.code)) : '—';
      const nameHtml = q ? highlightText(p.name, q) : escapeHtml(p.name);

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

    return table;
  }

  function updateSearchControls() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    if (!searchInput || !clearBtn) return;

    if (searchInput.value.trim().length > 0) {
      clearBtn.style.display = 'block';
    } else {
      clearBtn.style.display = 'none';
    }
  }

  // ── ОБРОБКА ПОДІЙ ТА ГАРЯЧИХ КЛАВІШ ───────────────────────────────────────
  function setupEvents() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.filterText = e.target.value;
        updateSearchControls();

        if (state.filterText.trim()) {
          allNodes.forEach(n => {
            if (n.children && n.children.length > 0) state.subcatsExpanded.add(n.id);
            if (n.own_products && n.own_products.length > 0) state.productsExpanded.add(n.id);
          });
        } else {
          state.subcatsExpanded.clear();
          allNodes.forEach(n => {
            if (n.children && n.children.length > 0) state.subcatsExpanded.add(n.id);
          });
          state.productsExpanded.clear();
        }
        render();
      });

      // Escape для очищення пошуку
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          state.filterText = '';
          updateSearchControls();
          resetToDefault();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        state.filterText = '';
        updateSearchControls();
        resetToDefault();
      });
    }

    // Глобальні гарячі клавіші (Ctrl+K або '/')
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

    // Безпечне екранування перед виділенням тегом
    return safeText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

})();
