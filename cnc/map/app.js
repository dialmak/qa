/**
 * app.js — Простий діловий лаконічний інтерфейс карти сайту
 * Меню категорій зліва (1-3 рівні), вибір категорій, таблиці товарів
 */

(function () {
  'use strict';

  // ── СТАН ДОДАТКУ ──────────────────────────────────────────────────────────
  const state = {
    mode: 'selected',             // 'selected' (Дерево категорій - по замовченню) або 'all' (Суцільний список)
    selectedNodeId: 'node-1',     // ID поточної категорії ("Контролери для ЧПК")
    sidebarCollapsed: new Set(),  // Згорнуті вузли в лівому меню

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

  // ── ЛІВЕ МЕНЮ КАТЕГОРІЙ ───────────────────────────────────────────────────
  function renderSidebar() {
    const container = document.getElementById('category-tree');
    container.innerHTML = '';

    function createSidebarNode(node) {
      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = state.sidebarCollapsed.has(node.id);
      const isActive = state.mode === 'selected' && state.selectedNodeId === node.id;

      const nodeEl = document.createElement('div');
      nodeEl.className = `nav-node lvl-${node.level}`;

      // Рядок категорії
      const row = document.createElement('div');
      row.className = `nav-row ${isActive ? 'active' : ''}`;

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

      // Назва
      const title = document.createElement('span');
      title.className = 'node-title';
      title.textContent = node.name;
      title.title = node.name;
      row.appendChild(title);

      // Кількість товарів
      const count = document.createElement('span');
      count.className = 'node-count';
      count.textContent = `(${node.stats.own_products || 0})`;
      row.appendChild(count);

      // Клік обирає категорію
      row.addEventListener('click', () => {
        state.selectedNodeId = node.id;
        state.mode = 'selected';
        updateTabsUI();
        renderSidebar();
        renderContent();
      });

      nodeEl.appendChild(row);

      // Дочірні категорії
      if (hasChildren) {
        const childrenBox = document.createElement('div');
        childrenBox.className = `nav-children ${isCollapsed ? 'hidden' : ''}`;
        node.children.forEach(child => {
          childrenBox.appendChild(createSidebarNode(child));
        });
        nodeEl.appendChild(childrenBox);
      }

      return nodeEl;
    }

    container.appendChild(createSidebarNode(window.CATALOG_DATA.tree));
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

    if (state.mode === 'all') {
      bc.innerHTML = `<span>Каталог</span> <span class="sep">/</span> <span class="crumb-current">Суцільний список (усі рівні)</span>`;
      badge.textContent = 'Огляд';
      heading.textContent = 'Суцільний список категорій та товарів';
      siteLink.href = window.CATALOG_DATA.tree.url;

      // Показуємо панель незалежних перемикачів для 3-х рівнів
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
    const prods = node.own_products || [];

    // 1. Якщо є підкатегорії — виводимо акуратний список/таблицю
    if (hasChildren) {
      const subBlock = document.createElement('div');
      subBlock.className = 'section-block';
      subBlock.innerHTML = `
        <div class="section-head">
          <span>Підкатегорії (${node.children.length})</span>
        </div>
        <div class="table-wrap">
          <table class="simple-table">
            <thead>
              <tr>
                <th class="col-n">№</th>
                <th>Назва підкатегорії</th>
                <th style="width: 80px; text-align: center;">Рівень</th>
                <th style="width: 100px; text-align: center;">Товарів</th>
                <th style="width: 110px; text-align: center;">В наявності</th>
                <th style="width: 140px; text-align: right;">Перейти на сайт</th>
              </tr>
            </thead>
            <tbody>
              ${node.children.map((ch, i) => `
                <tr>
                  <td class="col-n">${i + 1}</td>
                  <td>
                    <a href="#" class="cat-jump-link" data-id="${ch.id}"><strong>${ch.name}</strong></a>
                  </td>
                  <td style="text-align: center;">
                    <span class="level-tag">Рівень ${ch.level}</span>
                  </td>
                  <td style="text-align: center; font-weight: 600;">
                    ${ch.stats.total_products || ch.stats.own_products}
                  </td>
                  <td style="text-align: center;">
                    <span class="stock-badge yes">${ch.stats.total_yes || ch.stats.own_yes}</span>
                  </td>
                  <td style="text-align: right;">
                    <a href="${ch.url}" target="_blank" rel="noopener noreferrer" class="link-site" style="font-weight: 500;">Перейти на сайт ↗</a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      subBlock.querySelectorAll('.cat-jump-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          state.selectedNodeId = link.dataset.id;
          state.mode = 'selected';
          renderSidebar();
          renderContent();
        });
      });

      container.appendChild(subBlock);
    }

    // 2. Власні товари
    if (prods.length === 0) {
      if (!hasChildren) {
        const emptyBlock = document.createElement('div');
        emptyBlock.className = 'section-block';
        emptyBlock.innerHTML = `<div class="empty-note">У цій категорії немає товарів.</div>`;
        container.appendChild(emptyBlock);
      }
      return;
    }

    const prodBlock = document.createElement('div');
    prodBlock.className = 'section-block';

    const isVisible = isNodeProductsVisible(node);

    // Заголовок згідно з вимогою 1:
    const headerTitle = hasChildren
      ? `Товари категорії, які не входять до підкатегорій (${prods.length} шт.)`
      : `Товари категорії (${prods.length} шт.)`;

    prodBlock.innerHTML = `
      <div class="section-head">
        <span>${headerTitle}</span>
        <button class="btn-default" id="btn-toggle-single-prods">
          ${isVisible ? 'Приховати товари' : 'Показати товари'}
        </button>
      </div>
      <div class="table-wrap" id="single-prods-table" style="display: ${isVisible ? 'block' : 'none'};">
        ${renderTableHtml(prods)}
      </div>
    `;

    const toggleBtn = prodBlock.querySelector('#btn-toggle-single-prods');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const nextVis = !isNodeProductsVisible(node);
        state.nodeOverrides.set(node.id, nextVis);
        renderContent();
      });
    }

    container.appendChild(prodBlock);

    // 3. Сумарна табличка на сторінці Рівень 1
    if (node.level === 1) {
      container.appendChild(createSummaryBlock(node));
    }
  }

  // ── РЕЖИМ 2: ВЕСЬ КАТАЛОГ ─────────────────────────────────────────────────
  function renderAllView(container) {
    allNodes.forEach(node => {
      const prods = node.own_products || [];
      const hasProds = prods.length > 0;
      const hasChildren = node.children && node.children.length > 0;
      const isVisible = isNodeProductsVisible(node);

      const block = document.createElement('div');
      block.className = 'all-cat-block';

      // Заголовок блоку згідно з вимогою 1:
      const prodsLabel = hasChildren
        ? `Товари категорії, які не входять до підкатегорій (${prods.length} шт.)`
        : `Товари категорії (${prods.length} шт.)`;

      block.innerHTML = `
        <div class="all-cat-head" data-id="${node.id}">
          <div class="all-cat-title">
            <span class="level-tag">Рівень ${node.level}</span>
            <span>${node.name}</span>
          </div>
          <div class="all-cat-meta">
            ${hasChildren ? `<span style="color:var(--text-subtle); font-size:0.75rem;">Підкатегорій: ${node.children.length}</span>` : ''}
            <span style="font-weight:600; font-size:0.75rem;">${hasChildren ? `Не в підкат.: ${prods.length}` : `${prods.length} тов.`}</span>
            ${node.stats.own_yes > 0 ? `<span class="stock-badge yes">${node.stats.own_yes} в наявн.</span>` : ''}
            ${node.url ? `<a href="${node.url}" target="_blank" rel="noopener noreferrer" class="link-site" onclick="event.stopPropagation()">Сайт ↗</a>` : ''}
            ${hasProds ? `
              <button class="btn-default btn-toggle-cat" data-node="${node.id}" onclick="event.stopPropagation()">
                ${isVisible ? 'Приховати товари' : 'Показати товари'}
              </button>
            ` : ''}
          </div>
        </div>
        ${hasProds ? `
          <div class="table-wrap" id="block-table-${node.id}" style="display: ${isVisible ? 'block' : 'none'};">
            <div class="table-subhead">
              ${prodsLabel}
            </div>
            ${renderTableHtml(prods)}
          </div>
        ` : ''}
      `;

      // Клік по кнопці або рядку заголовка перемикає показ товарів ДЛЯ ЦІЄЇ КАТЕГОРІЇ НЕЗАЛЕЖНО
      if (hasProds) {
        const toggleBtn = block.querySelector('.btn-toggle-cat');
        const triggerToggle = (e) => {
          if (e) e.stopPropagation();
          const nextVis = !isNodeProductsVisible(node);
          state.nodeOverrides.set(node.id, nextVis);
          renderContent();
        };

        if (toggleBtn) toggleBtn.addEventListener('click', triggerToggle);
        const head = block.querySelector('.all-cat-head');
        head.addEventListener('click', triggerToggle);
      }

      container.appendChild(block);
    });

    // 3. Сумарна табличка в кінці загального каталогу
    if (window.CATALOG_DATA && window.CATALOG_DATA.tree) {
      container.appendChild(createSummaryBlock(window.CATALOG_DATA.tree));
    }
  }

  // ── ГЕНЕРАЦІЯ HTML ТАБЛИЦІ ТОВАРІВ ────────────────────────────────────────
  function renderTableHtml(products) {
    return `
      <table class="simple-table">
        <thead>
          <tr>
            <th class="col-n">№</th>
            <th class="col-code">Код</th>
            <th>Назва товару</th>
            <th class="col-avail">Наявність</th>
          </tr>
        </thead>
        <tbody>
          ${products.map((p, i) => {
            const isYes = p.availability.toLowerCase().includes('в наявності');
            return `
              <tr>
                <td class="col-n">${p.index || i + 1}</td>
                <td class="col-code">
                  <span class="item-code">${p.code || '—'}</span>
                </td>
                <td class="col-name">
                  ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer">${p.name}</a>` : p.name}
                </td>
                <td class="col-avail">
                  <span class="stock-badge ${isYes ? 'yes' : 'no'}">
                    ${isYes ? 'В наявності' : 'Немає'}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // ── СУМАРНА ТАБЛИЧКА ДЛЯ РІВНЯ 1 ──────────────────────────────────────────
  function createSummaryBlock(node) {
    const stats = node.stats || {};
    const ownTotal = stats.own_products || (node.own_products ? node.own_products.length : 0);
    const ownYes = stats.own_yes || 0;
    const ownNo = stats.own_no || 0;

    const allTotal = stats.total_products || ownTotal;
    const allYes = stats.total_yes || ownYes;
    const allNo = stats.total_no || ownNo;

    const subTotal = allTotal - ownTotal;
    const subYes = allYes - ownYes;
    const subNo = allNo - ownNo;

    const block = document.createElement('div');
    block.className = 'section-block summary-block';

    block.innerHTML = `
      <div class="section-head">
        <span>Підсумкова таблиця розділу «${node.name}»</span>
      </div>
      <div class="table-wrap">
        <table class="simple-table summary-table">
          <thead>
            <tr>
              <th>Розділ / Категорія</th>
              <th style="width: 140px; text-align: center;">К-сть товарів</th>
              <th style="width: 130px; text-align: center;">В наявності</th>
              <th style="width: 170px; text-align: center;">Немає в наявності</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Товари категорії, які не входять до підкатегорій</td>
              <td style="text-align: center; font-weight: 600;">${ownTotal}</td>
              <td style="text-align: center;"><span class="stock-badge yes">${ownYes}</span></td>
              <td style="text-align: center;"><span class="stock-badge no">${ownNo}</span></td>
            </tr>
            ${subTotal > 0 ? `
              <tr>
                <td>Товари в підкатегоріях (Рівні 2–3)</td>
                <td style="text-align: center; font-weight: 600;">${subTotal}</td>
                <td style="text-align: center;"><span class="stock-badge yes">${subYes}</span></td>
                <td style="text-align: center;"><span class="stock-badge no">${subNo}</span></td>
              </tr>
            ` : ''}
          </tbody>
          <tfoot>
            <tr style="font-weight: 700;">
              <td><strong>Разом</strong></td>
              <td style="text-align: center; font-weight: 700; font-size: 0.95rem;">${allTotal}</td>
              <td style="text-align: center;"><span class="stock-badge yes" style="font-weight: 700;">${allYes}</span></td>
              <td style="text-align: center;"><span class="stock-badge no" style="font-weight: 700;">${allNo}</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
    return block;
  }

  // ── ОБРОБНИКИ ПОДІЙ ───────────────────────────────────────────────────────
  function setupEvents() {
    // Вкладки: Весь каталог / Обраний розділ
    document.getElementById('tab-all').addEventListener('click', () => {
      state.mode = 'all';
      updateTabsUI();
      renderSidebar();
      renderContent();
    });

    document.getElementById('tab-selected').addEventListener('click', () => {
      state.mode = 'selected';
      updateTabsUI();
      renderSidebar();
      renderContent();
    });

    // Розгорнути/Згорнути всі в лівому меню
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

    // Незалежні кнопки показу/приховання для кожного рівня (Вимога 2)
    [1, 2, 3].forEach(lvl => {
      const btn = document.getElementById(`btn-toggle-lvl-${lvl}`);
      if (btn) {
        btn.addEventListener('click', () => {
          state.levelVisible[lvl] = !state.levelVisible[lvl];

          // Скидаємо індивідуальні перемикання для цього рівня, щоб спрацювало групове перемикання
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

    // Перемикач темної / світлої теми (Вимога 1)
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

})();
