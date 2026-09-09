/**
 * site_map / app_simple.js
 * Максимально простий скрипт вертикального списку каталогу
 * - Без тем оформлення
 * - За замовчуванням: розгорнуті всі категорії та підкатегорії (товари приховані)
 * - Окреме розгортання/згортання товарів по кожній категорії
 */

(function () {
  'use strict';

  const state = {
    subcatsExpanded: new Set(),
    productsExpanded: new Set(),
    filterText: ''
  };

  let rootNode = null;
  let allNodes = [];

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.CATALOG_DATA || !window.CATALOG_DATA.tree) {
      document.getElementById('tree').innerHTML = '<div style="color:red; padding:10px;">Дані каталогу не знайдено (data.js).</div>';
      return;
    }

    rootNode = window.CATALOG_DATA.tree;
    indexNodes(rootNode);
    initTheme();
    resetToDefault();
    setupEvents();
  });

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

    // Розгортаємо всі вузли, які мають дочірні підкатегорії
    allNodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        state.subcatsExpanded.add(node.id);
      }
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    render();
  }

  function render() {
    const container = document.getElementById('tree');
    container.innerHTML = '';

    if (!rootNode) return;
    container.appendChild(renderNode(rootNode));
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
    name.textContent = node.name;
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
      // Якщо в категорії 0 власних товарів (наприклад, усі товари розподілені по підкатегоріях),
      // створюємо блок фіксованої ширини (320px), щоб вертикальне вирівнювання колонок не з'їжджало
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

    // Підказка при наведенні
    const labelForTitle = hasChildren ? 'товари поза підкатегоріями' : 'товари категорії';
    row.title = hasProds ? (isProdExpanded ? `Згорнути ${labelForTitle}` : `Розгорнути ${labelForTitle}`) : '';

    // Клік по рядку розгортає/згортає товари (підкатегорії керуються виключно окремою кнопкою [+/-] зліва)
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
      prodsWrap.appendChild(renderTable(filteredProds));
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

  function renderTable(products) {
    const table = document.createElement('table');
    table.className = 'table-prods';

    if (!products || products.length === 0) {
      table.innerHTML = '<tr><td style="padding:8px; color:#9ca3af;">Товарів не знайдено</td></tr>';
      return table;
    }

    const rows = products.map((p, idx) => {
      const isYes = p.availability && p.availability.toLowerCase().includes('в наявності');
      return `
        <tr>
          <td class="col-n">${p.index || (idx + 1)}</td>
          <td class="col-code">${p.code || '—'}</td>
          <td class="col-name">
            ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer">${p.name}</a>` : p.name}
          </td>
          <td class="col-avail">
            <span class="${isYes ? 'badge-yes' : 'badge-no'}">${p.availability || '—'}</span>
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

  function setupEvents() {
    // Пошук
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.filterText = e.target.value;
        if (state.filterText.trim()) {
          allNodes.forEach(n => {
            if (n.children && n.children.length > 0) state.subcatsExpanded.add(n.id);
            if (n.own_products && n.own_products.length > 0) state.productsExpanded.add(n.id);
          });
        } else {
          // Якщо рядок пошуку порожній — повертаємося до дефолту
          state.subcatsExpanded.clear();
          allNodes.forEach(n => {
            if (n.children && n.children.length > 0) state.subcatsExpanded.add(n.id);
          });
          state.productsExpanded.clear();
        }
        render();
      });
    }

    // Перемикач теми
    const btnTheme = document.getElementById('btn-theme-toggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', toggleTheme);
    }
  }

  // ── ТЕМА ОФОРМЛЕННЯ (ТЕМНА ЗА ЗАМОВЧУВАННЯМ / СВІТЛА) ─────────────────────
  function initTheme() {
    let currentTheme = 'dark';
    try {
      const savedTheme = localStorage.getItem('theme_simple');
      if (savedTheme) {
        currentTheme = savedTheme;
      }
    } catch (e) {}
    applyTheme(currentTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme_simple', theme);
    } catch (e) {}
    updateThemeButtonUI(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  function updateThemeButtonUI(theme) {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    const icon = btn.querySelector('.theme-icon');
    const text = btn.querySelector('.theme-text');
    if (theme === 'dark') {
      if (icon) icon.textContent = '☀️';
      if (text) text.textContent = 'Світла';
      btn.title = 'Перемкнути на світлу тему';
    } else {
      if (icon) icon.textContent = '🌙';
      if (text) text.textContent = 'Темна';
      btn.title = 'Перемкнути на темну тему';
    }
  }

})();

