/**
 * app_onovlenij.js — Оновлена структура каталогу «Контролери для ЧПК»
 * 8 основних категорій (172 товари) + 1 окрема категорія на перенесення (6 товарів).
 * Посилання на сайт категорій 2 та 3 рівня прибрані; всі посилання на товари збережені.
 */

(function () {
  'use strict';

  // ── СТАН ДОДАТКУ ──────────────────────────────────────────────────────────
  const state = {
    mode: 'selected',             // 'selected' (Дерево категорій) або 'all' (Суцільний список)
    selectedNodeId: 'node-root',  // ID поточної категорії (по замовченню корінь)
    sidebarCollapsed: new Set(),  // Згорнуті вузли в лівому меню

    // Незалежний показ товарів для кожного рівня
    levelVisible: {
      3: true,
      transfer: true
    },
    // Індивідуальні перемикання для конкретних вузлів
    nodeOverrides: new Map()
  };

  let nodeMap = new Map();
  let parentMap = new Map();
  let allNodes = [];

  // ── ІНІЦІАЛІЗАЦІЯ ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.CATALOG_DATA_ONOVLENIJ || !window.CATALOG_DATA_ONOVLENIJ.tree) {
      document.getElementById('content-body').innerHTML = `
        <div class="empty-note" style="color: red;">
          Не вдалося завантажити data_onovlenij.js. Перевірте наявність файлу.
        </div>
      `;
      return;
    }

    indexTree(window.CATALOG_DATA_ONOVLENIJ.tree, null);
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
    if (node.is_removal) {
      return state.levelVisible.transfer;
    }
    return state.levelVisible[node.level] !== false;
  }

  // ── ЛІВЕ МЕНЮ (САЙДБАР) ───────────────────────────────────────────────────
  function renderSidebar() {
    const treeContainer = document.getElementById('category-tree');
    treeContainer.innerHTML = '';

    const root = window.CATALOG_DATA_ONOVLENIJ.tree;
    const treeFragment = buildNavNode(root);
    treeContainer.appendChild(treeFragment);
  }

  function buildNavNode(node) {
    const wrap = document.createElement('div');
    wrap.className = `nav-node lvl-${node.level}`;
    wrap.setAttribute('data-id', node.id);

    const isSelected = state.selectedNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = state.sidebarCollapsed.has(node.id);

    const row = document.createElement('div');
    row.className = `nav-row ${isSelected ? 'active' : ''}`;

    // Стрілочка для розгортання
    const arrow = document.createElement('span');
    arrow.className = `arrow ${!hasChildren ? 'empty' : (isCollapsed ? 'closed' : 'open')}`;
    arrow.innerHTML = '▼';
    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!hasChildren) return;
      if (state.sidebarCollapsed.has(node.id)) {
        state.sidebarCollapsed.delete(node.id);
      } else {
        state.sidebarCollapsed.add(node.id);
      }
      renderSidebar();
    });

    // Назва категорії
    const title = document.createElement('span');
    title.className = 'node-title';
    if (node.is_removal && node.level === 2) {
      title.innerHTML = `⚠️ ${node.short_name || node.name}`;
      title.style.color = 'var(--status-no)';
    } else {
      title.textContent = node.name;
    }

    // Лічильник товарів
    const count = document.createElement('span');
    count.className = 'node-count';
    const totalP = node.stats.total_products;
    count.textContent = `(${totalP})`;

    row.appendChild(arrow);
    row.appendChild(title);
    row.appendChild(count);

    // Клік по категорії
    row.addEventListener('click', () => {
      state.selectedNodeId = node.id;
      if (state.mode === 'all') {
        state.mode = 'selected';
        updateTabsUI();
      }
      renderSidebar();
      renderContent();
    });

    wrap.appendChild(row);

    // Дочірні категорії
    if (hasChildren) {
      const childrenBox = document.createElement('div');
      childrenBox.className = `nav-children ${isCollapsed ? 'hidden' : ''}`;
      node.children.forEach(child => {
        childrenBox.appendChild(buildNavNode(child));
      });
      wrap.appendChild(childrenBox);
    }

    return wrap;
  }

  // ── ПРАВА ПАНЕЛЬ (ОСНОВНИЙ ВМІСТ) ─────────────────────────────────────────
  function renderContent() {
    const container = document.getElementById('content-body');
    container.innerHTML = '';

    if (state.mode === 'all') {
      renderAllView(container);
    } else {
      renderSelectedView(container);
    }

    updateHeaderUI();
    updateLevelTogglesUI();
  }

  function updateHeaderUI() {
    const node = nodeMap.get(state.selectedNodeId) || window.CATALOG_DATA_ONOVLENIJ.tree;
    const breadcrumbs = document.getElementById('breadcrumbs');
    const badge = document.getElementById('cat-level-badge');
    const heading = document.getElementById('cat-heading');
    const toggleBar = document.getElementById('level-toggles-bar');

    if (state.mode === 'all') {
      breadcrumbs.innerHTML = `<span>Каталог</span> <span class="crumb-sep">/</span> <span class="crumb-current">Суцільний список усіх розділів</span>`;
      badge.textContent = 'Всі рівні';
      badge.className = 'level-tag';
      heading.textContent = 'Повний оновлений каталог товарів (178 позицій)';
      if (toggleBar) {
        toggleBar.style.display = 'flex';
        updateLevelTogglesUI();
      }
      return;
    }

    if (toggleBar) {
      toggleBar.style.display = 'none';
    }

    // Хлібні крихти
    const path = getPath(node);
    breadcrumbs.innerHTML = '';
    path.forEach((pNode, idx) => {
      if (idx > 0) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '/';
        breadcrumbs.appendChild(sep);
      }
      if (idx === path.length - 1) {
        const span = document.createElement('span');
        span.className = 'crumb-current';
        span.textContent = pNode.name;
        breadcrumbs.appendChild(span);
      } else {
        const a = document.createElement('span');
        a.className = 'crumb-link';
        a.textContent = pNode.name;
        a.addEventListener('click', () => {
          state.selectedNodeId = pNode.id;
          renderSidebar();
          renderContent();
        });
        breadcrumbs.appendChild(a);
      }
    });

    // Бейдж рівня
    if (node.is_removal) {
      badge.textContent = node.level === 2 ? '⚠️ Окремий аркуш' : '⚠️ До перенесення';
      badge.className = 'level-tag transfer';
    } else {
      badge.textContent = `Рівень ${node.level}`;
      badge.className = 'level-tag';
    }

    heading.textContent = node.name;
  }

  // ── РЕЖИМ 1: ОБРАНИЙ РОЗДІЛ (ДЕРЕВО КАТЕГОРІЙ) ────────────────────────────
  function renderSelectedView(container) {
    const node = nodeMap.get(state.selectedNodeId);
    if (!node) return;

    // ВАРІАНТ А: Кореневий вузол Рівня 1
    if (node.level === 1) {
      renderRootLevelView(node, container);
      return;
    }

    // ВАРІАНТ Б: Окрема категорія на перенесення (Рівень 2)
    if (node.is_removal && node.level === 2) {
      renderRemovalCategoryView(node, container);
      return;
    }

    // ВАРІАНТ В: Основна категорія Рівня 2 (8 категорій)
    if (node.level === 2) {
      renderLevel2CategoryView(node, container);
      return;
    }

    // ВАРІАНТ Г: Підкатегорія Рівня 3
    if (node.level === 3) {
      renderLevel3SubcategoryView(node, container);
      return;
    }
  }

  // 1. Рівень 1: Загальний огляд категорій та підсумки
  function renderRootLevelView(node, container) {
    const gs = window.CATALOG_DATA_ONOVLENIJ.global_stats;
    const mainCats = (node.children || []).filter(ch => !ch.is_removal);
    const remCat = (node.children || []).find(ch => ch.is_removal);

    // Інформаційна плашка
    const banner = document.createElement('div');
    banner.className = 'info-banner';
    banner.innerHTML = `
      <div>
        <strong>Оновлена структура каталогу «Контролери для ЧПК»:</strong><br>
        8 категорій та 23 підкатегорії;<br>
        6 непрофільних або застарілих товарів виділено в окрему групу.
      </div>
    `;
    container.appendChild(banner);

    // Таблиця категорій Рівня 2
    const tableBlock = document.createElement('div');
    tableBlock.className = 'section-block';
    tableBlock.innerHTML = `
      <div class="section-head">
        <span>Категорії (${mainCats.length})</span>
      </div>
      <div class="table-wrap">
        <table class="simple-table">
          <thead>
            <tr>
              <th class="col-n">№</th>
              <th>Назва категорії</th>
              <th style="width: 110px; text-align: center;">Підкатегорій</th>
              <th style="width: 120px; text-align: center;">К-сть товарів</th>
              <th style="width: 120px; text-align: center;">В наявності</th>
              <th style="width: 130px; text-align: center;">Немає в наявн.</th>
            </tr>
          </thead>
          <tbody>
            ${mainCats.map((ch, idx) => {
              const subCount = ch.children ? ch.children.length : 0;
              return `
                <tr>
                  <td class="col-n">${idx + 1}</td>
                  <td>
                    <a href="#" class="cat-jump-link" data-id="${ch.id}">
                      <strong>${ch.name}</strong>
                    </a>
                  </td>
                  <td style="text-align: center; color: var(--text-muted);">${subCount}</td>
                  <td style="text-align: center; font-weight: 600;">${ch.stats.total_products}</td>
                  <td style="text-align: center;"><span class="stock-badge yes">${ch.stats.total_yes}</span></td>
                  <td style="text-align: center;"><span class="stock-badge no">${ch.stats.total_no}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: 600; background: var(--bg-subtle);">
              <td colspan="2"><strong>Підсумок основного каталогу (8 категорій, 23 підкатегорії):</strong></td>
              <td style="text-align: center;">23</td>
              <td style="text-align: center; font-weight: 700;">${gs.main_catalog_products}</td>
              <td style="text-align: center;"><span class="stock-badge yes" style="font-weight: 700;">${gs.main_catalog_yes}</span></td>
              <td style="text-align: center;"><span class="stock-badge no" style="font-weight: 700;">${gs.main_catalog_no}</span></td>
            </tr>
            ${remCat ? `
              <tr style="background: rgba(234, 179, 8, 0.06); font-weight: 500;">
                <td class="col-n" style="color: var(--status-no); font-size: 0.9rem;">⚠️</td>
                <td>
                  <a href="#" class="cat-jump-link" data-id="${remCat.id}" style="color: var(--status-no);">
                    <strong>${remCat.name}</strong>
                  </a>
                </td>
                <td style="text-align: center; color: var(--text-muted);">${remCat.children ? remCat.children.length : 4}</td>
                <td style="text-align: center; font-weight: 600;">${remCat.stats.total_products}</td>
                <td style="text-align: center;"><span class="stock-badge yes">${remCat.stats.total_yes}</span></td>
                <td style="text-align: center;"><span class="stock-badge no">${remCat.stats.total_no}</span></td>
              </tr>
            ` : ''}
            <tr style="font-weight: 700;">
              <td colspan="2"><strong>РАЗОМ ПО КАТАЛОГУ (разом із аркушем перенесення):</strong></td>
              <td style="text-align: center;">27</td>
              <td style="text-align: center; font-weight: 700; font-size: 0.95rem;">${gs.total_products}</td>
              <td style="text-align: center;"><span class="stock-badge yes" style="font-weight: 700;">${gs.total_yes}</span></td>
              <td style="text-align: center;"><span class="stock-badge no" style="font-weight: 700;">${gs.total_no}</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    // Клік по назві категорії перемикає на Рівень 2
    tableBlock.querySelectorAll('.cat-jump-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        state.selectedNodeId = link.getAttribute('data-id');
        state.mode = 'selected';
        renderSidebar();
        renderContent();
      });
    });

    container.appendChild(tableBlock);
  }

  // 2. Рівень 2: Основна категорія каталогу (показує ТІЛЬКИ таблицю підкатегорій)
  function renderLevel2CategoryView(node, container) {
    const subcats = node.children || [];

    const subcatsBlock = document.createElement('div');
    subcatsBlock.className = 'section-block';
    subcatsBlock.innerHTML = `
      <div class="section-head">
        <span>Підкатегорії (${subcats.length})</span>
      </div>
      <div class="table-wrap">
        <table class="simple-table">
          <thead>
            <tr>
              <th class="col-n">№</th>
              <th>Назва підкатегорії</th>
              <th style="width: 120px; text-align: center;">К-сть товарів</th>
              <th style="width: 120px; text-align: center;">В наявності</th>
              <th style="width: 130px; text-align: center;">Немає в наявн.</th>
            </tr>
          </thead>
          <tbody>
            ${subcats.map((sc, idx) => `
              <tr>
                <td class="col-n">${idx + 1}</td>
                <td>
                  <a href="#" class="cat-jump-link" data-id="${sc.id}">
                    <strong>${sc.name}</strong>
                  </a>
                </td>
                <td style="text-align: center; font-weight: 600;">${sc.stats.total_products}</td>
                <td style="text-align: center;">
                  ${sc.stats.total_yes > 0 ? `<span class="stock-badge yes">${sc.stats.total_yes}</span>` : '—'}
                </td>
                <td style="text-align: center;">
                  ${sc.stats.total_no > 0 ? `<span class="stock-badge no">${sc.stats.total_no}</span>` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: 700;">
              <td></td>
              <td><strong>Всього у категорії:</strong></td>
              <td style="text-align: center;">${node.stats.total_products}</td>
              <td style="text-align: center;"><span class="stock-badge yes">${node.stats.total_yes}</span></td>
              <td style="text-align: center;"><span class="stock-badge no">${node.stats.total_no}</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    // Клік по назві підкатегорії перемикає на Рівень 3 (де вже показано товари)
    subcatsBlock.querySelectorAll('.cat-jump-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        state.selectedNodeId = link.getAttribute('data-id');
        state.mode = 'selected';
        renderSidebar();
        renderContent();
      });
    });

    container.appendChild(subcatsBlock);
  }

  // 3. Рівень 2: Окрема категорія перенесення (показує ТІЛЬКИ таблицю підкатегорій/груп)
  function renderRemovalCategoryView(node, container) {
    const subcats = node.children || [];

    const banner = document.createElement('div');
    banner.className = 'info-banner warning';
    banner.innerHTML = `
      <div>
        <strong>⚠️ Аркуш «Рекомендовані до видалення» (Товари до перенесення в інші категорії):</strong><br>
        Ці 6 товарів винесено на окремий аркуш Excel-файлу, оскільки вони є непрофільними для систем керування ЧПК (зарядки АКБ, побутові симісторні дімери, ПЛК для заводських ліній Siemens) або пластиковою кріпильною фурнітурою та застарілими картками. Всі вони мають прямі робочі посилання на сайт cncprom.ua.
      </div>
    `;
    container.appendChild(banner);

    const subcatsBlock = document.createElement('div');
    subcatsBlock.className = 'section-block';
    subcatsBlock.innerHTML = `
      <div class="section-head">
        <span>Підкатегорії (${subcats.length})</span>
      </div>
      <div class="table-wrap">
        <table class="simple-table">
          <thead>
            <tr>
              <th class="col-n">№</th>
              <th>Назва групи / підкатегорії</th>
              <th style="width: 120px; text-align: center;">К-сть товарів</th>
              <th style="width: 120px; text-align: center;">В наявності</th>
              <th style="width: 130px; text-align: center;">Немає в наявн.</th>
            </tr>
          </thead>
          <tbody>
            ${subcats.map((grp, idx) => `
              <tr>
                <td class="col-n">${idx + 1}</td>
                <td>
                  <a href="#" class="cat-jump-link" data-id="${grp.id}" style="color: var(--status-no);">
                    <strong>${grp.name}</strong>
                  </a>
                </td>
                <td style="text-align: center; font-weight: 600;">${grp.stats.total_products}</td>
                <td style="text-align: center;">
                  ${grp.stats.total_yes > 0 ? `<span class="stock-badge yes">${grp.stats.total_yes}</span>` : '—'}
                </td>
                <td style="text-align: center;">
                  ${grp.stats.total_no > 0 ? `<span class="stock-badge no">${grp.stats.total_no}</span>` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: 700;">
              <td></td>
              <td><strong>Всього до перенесення:</strong></td>
              <td style="text-align: center;">${node.stats.total_products}</td>
              <td style="text-align: center;"><span class="stock-badge yes">${node.stats.total_yes}</span></td>
              <td style="text-align: center;"><span class="stock-badge no">${node.stats.total_no}</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    // Клік по групі перемикає на її товари з причинами вилучення
    subcatsBlock.querySelectorAll('.cat-jump-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        state.selectedNodeId = link.getAttribute('data-id');
        state.mode = 'selected';
        renderSidebar();
        renderContent();
      });
    });

    container.appendChild(subcatsBlock);
  }

  // 4. Рівень 3: Конкретна підкатегорія (показує таблицю товарів)
  function renderLevel3SubcategoryView(node, container) {
    const prods = node.own_products || [];

    const prodBlock = document.createElement('div');
    prodBlock.className = 'section-block';

    const isVisible = isNodeProductsVisible(node);

    prodBlock.innerHTML = `
      <div class="section-head">
        <span>Товари (${prods.length})</span>
        <button class="btn-default" id="btn-toggle-l3-prods">
          ${isVisible ? 'Приховати товари' : 'Показати товари'}
        </button>
      </div>
      <div class="table-wrap" id="single-prods-table" style="display: ${isVisible ? 'block' : 'none'};">
        ${node.is_removal ? renderRemovalProductTableHtml(prods) : renderProductTableHtml(prods)}
      </div>
    `;

    prodBlock.querySelector('#btn-toggle-l3-prods').addEventListener('click', () => {
      const nextVis = !isNodeProductsVisible(node);
      state.nodeOverrides.set(node.id, nextVis);
      renderContent();
    });

    container.appendChild(prodBlock);
  }

  // ── РЕЖИМ 2: ВЕСЬ КАТАЛОГ (СУЦІЛЬНИЙ СПИСОК) ──────────────────────────────
  function renderAllView(container) {
    const root = window.CATALOG_DATA_ONOVLENIJ.tree;

    root.children.forEach(l2Node => {
      const isRem = l2Node.is_removal;
      const subcats = l2Node.children || [];
      const isL2Visible = isNodeProductsVisible(l2Node);

      const l2Block = document.createElement('div');
      l2Block.className = 'all-cat-block';
      l2Block.innerHTML = `
        <div class="all-cat-head" data-id="${l2Node.id}" style="${isRem ? 'background: rgba(234, 179, 8, 0.08);' : ''}">
          <div class="all-cat-title">
            <span class="level-tag ${isRem ? 'transfer' : ''}">${isRem ? '⚠️ До перенесення' : 'Рівень 2'}</span>
            <a href="#" class="cat-jump-link" data-id="${l2Node.id}" style="${isRem ? 'color: var(--status-no);' : ''}">
              <strong>${l2Node.name}</strong>
            </a>
          </div>
          <div class="all-cat-meta">
            <span style="color:var(--text-subtle); font-size:0.75rem;">Підкатегорій: ${subcats.length}</span>
            <span style="font-weight:600; font-size:0.75rem;">${l2Node.stats.total_products} тов.</span>
            ${l2Node.stats.total_yes > 0 ? `<span class="stock-badge yes">${l2Node.stats.total_yes} в наявн.</span>` : ''}
            <button class="btn-default btn-toggle-l2" data-id="${l2Node.id}" onclick="event.stopPropagation()">
              ${isL2Visible ? 'Приховати товари' : 'Показати товари'}
            </button>
          </div>
        </div>
      `;

      l2Block.querySelector('.btn-toggle-l2').addEventListener('click', () => {
        const nextVis = !isNodeProductsVisible(l2Node);
        state.nodeOverrides.set(l2Node.id, nextVis);
        // Також перемикаємо всі дочірні
        subcats.forEach(sc => state.nodeOverrides.set(sc.id, nextVis));
        renderContent();
      });

      // Всередині кожної категорії Рівня 2 показуємо її підкатегорії
      if (isL2Visible) {
        subcats.forEach(sc => {
          const prods = sc.own_products || [];
          if (prods.length === 0) return;

          const isScVisible = isNodeProductsVisible(sc);
          const scWrap = document.createElement('div');
          scWrap.style.borderTop = '1px solid var(--border-color)';

          scWrap.innerHTML = `
            <div class="table-subhead" style="display: flex; align-items: center; justify-content: space-between;">
              <span>📂 <a href="#" class="cat-jump-link" data-id="${sc.id}"><strong>${sc.name}</strong></a> (${prods.length})</span>
              <button class="btn-link" style="cursor: pointer;" data-id="${sc.id}">
                ${isScVisible ? 'Приховати' : 'Показати'}
              </button>
            </div>
            <div class="table-wrap" style="display: ${isScVisible ? 'block' : 'none'};">
              ${isRem ? renderRemovalProductTableHtml(prods) : renderProductTableHtml(prods)}
            </div>
          `;

          scWrap.querySelector('.btn-link').addEventListener('click', (e) => {
            e.stopPropagation();
            const nextVis = !isNodeProductsVisible(sc);
            state.nodeOverrides.set(sc.id, nextVis);
            renderContent();
          });

          l2Block.appendChild(scWrap);
        });
      }

      container.appendChild(l2Block);
    });

    // Підсумкова таблиця в кінці загального каталогу
    const gs = window.CATALOG_DATA_ONOVLENIJ.global_stats;
    const summaryBlock = document.createElement('div');
    summaryBlock.className = 'section-block';
    summaryBlock.style.marginTop = '16px';
    summaryBlock.innerHTML = `
      <div class="section-head">
        <span>Загальний підсумок каталогу</span>
      </div>
      <div class="table-wrap">
        <table class="simple-table">
          <thead>
            <tr>
              <th>Розділ каталогу</th>
              <th style="width: 120px; text-align: center;">Категорій</th>
              <th style="width: 120px; text-align: center;">Підкатегорій</th>
              <th style="width: 130px; text-align: center;">К-сть товарів</th>
              <th style="width: 130px; text-align: center;">В наявності</th>
              <th style="width: 130px; text-align: center;">Немає в наявн.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Основний каталог «Контролери для ЧПК» (1–3 рівні)</strong></td>
              <td style="text-align: center;">8</td>
              <td style="text-align: center;">23</td>
              <td style="text-align: center; font-weight: 600;">${gs.main_catalog_products}</td>
              <td style="text-align: center;"><span class="stock-badge yes">${gs.main_catalog_yes}</span></td>
              <td style="text-align: center;"><span class="stock-badge no">${gs.main_catalog_no}</span></td>
            </tr>
            <tr style="background: rgba(234, 179, 8, 0.05);">
              <td><span style="color: var(--status-no); font-weight: 600;">⚠️ Товари, рекомендовані до перенесення</span></td>
              <td style="text-align: center;">1</td>
              <td style="text-align: center;">4</td>
              <td style="text-align: center; font-weight: 600;">${gs.removal_products}</td>
              <td style="text-align: center;"><span class="stock-badge yes">${gs.removal_yes}</span></td>
              <td style="text-align: center;"><span class="stock-badge no">${gs.removal_no}</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="font-weight: 700;">
              <td><strong>РАЗОМ ПО КАТАЛОГУ:</strong></td>
              <td style="text-align: center;">9</td>
              <td style="text-align: center;">27</td>
              <td style="text-align: center; font-size: 0.92rem;">${gs.total_products}</td>
              <td style="text-align: center;"><span class="stock-badge yes">${gs.total_yes}</span></td>
              <td style="text-align: center;"><span class="stock-badge no">${gs.total_no}</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
    container.appendChild(summaryBlock);

    // Клік по категорії/підкатегорії перемикає на її перегляд у режимі дерева
    container.querySelectorAll('.cat-jump-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.selectedNodeId = link.getAttribute('data-id');
        state.mode = 'selected';
        updateTabsUI();
        renderSidebar();
        renderContent();
      });
    });
  }

  // ── ГЕНЕРАЦІЯ ТАБЛИЦІ ТОВАРІВ ─────────────────────────────────────────────
  // ВСІ назви товарів містять прямі посилання на сайт cncprom.ua!
  function renderProductTableHtml(products) {
    if (!products || products.length === 0) {
      return '<div class="empty-note">У цій підкатегорії немає товарів</div>';
    }

    return `
      <table class="simple-table">
        <thead>
          <tr>
            <th class="col-n">№</th>
            <th class="col-code">Код</th>
            <th>Назва товару (клікабельне посилання на сайт)</th>
            <th class="col-avail">Наявність</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
            const isYes = p.availability.toLowerCase().includes('в наявності');
            return `
              <tr>
                <td class="col-n">${p.index}</td>
                <td class="col-code"><span class="item-code">${p.code}</span></td>
                <td class="col-name">
                  ${p.url 
                    ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer" title="Відкрити товар на cncprom.ua">${p.name}</a>` 
                    : p.name}
                </td>
                <td class="col-avail">
                  <span class="stock-badge ${isYes ? 'yes' : 'no'}">
                    ${p.availability}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // Таблиця товарів для аркуша вилучення (із зазначенням причини)
  function renderRemovalProductTableHtml(products) {
    if (!products || products.length === 0) {
      return '<div class="empty-note">У цій групі немає товарів</div>';
    }

    return `
      <table class="simple-table">
        <thead>
          <tr>
            <th class="col-n">№</th>
            <th class="col-code">Код</th>
            <th>Назва товару (посилання на сайт)</th>
            <th class="col-avail">Наявність</th>
            <th class="col-reason">Причина вилучення / куди перенести</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
            const isYes = p.availability.toLowerCase().includes('в наявності');
            return `
              <tr>
                <td class="col-n">${p.index}</td>
                <td class="col-code"><span class="item-code">${p.code}</span></td>
                <td class="col-name">
                  ${p.url 
                    ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer" title="Відкрити товар на cncprom.ua">${p.name}</a>` 
                    : p.name}
                </td>
                <td class="col-avail">
                  <span class="stock-badge ${isYes ? 'yes' : 'no'}">
                    ${p.availability}
                  </span>
                </td>
                <td class="col-reason">
                  ${p.reason || '—'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // ── КЕРУВАННЯ ПЕРЕМИКАЧАМИ РІВНІВ (ДЛЯ СУЦІЛЬНОГО СПИСКУ) ─────────────────
  function updateLevelTogglesUI() {
    const toggleBar = document.getElementById('level-toggles-bar');
    if (!toggleBar) return;

    if (state.mode !== 'all') {
      toggleBar.style.display = 'none';
      return;
    }
    toggleBar.style.display = 'flex';

    const btnL3 = document.getElementById('btn-toggle-lvl-3');
    if (btnL3) {
      const isVis = state.levelVisible[3];
      btnL3.classList.toggle('active', isVis);
      const statusSpan = btnL3.querySelector('.status-text');
      if (statusSpan) {
        statusSpan.textContent = isVis ? 'Показано' : 'Приховано';
      }
    }

    const btnTransfer = document.getElementById('btn-toggle-transfer');
    if (btnTransfer) {
      const isVis = state.levelVisible.transfer;
      btnTransfer.classList.toggle('active', isVis);
      const statusSpan = btnTransfer.querySelector('.status-text');
      if (statusSpan) {
        statusSpan.textContent = isVis ? 'Показано' : 'Приховано';
      }
    }
  }

  function updateTabsUI() {
    const tabSelected = document.getElementById('tab-selected');
    const tabAll = document.getElementById('tab-all');
    if (tabSelected && tabAll) {
      tabSelected.classList.toggle('active', state.mode === 'selected');
      tabAll.classList.toggle('active', state.mode === 'all');
    }
  }

  // ── ОБРОБНИКИ ПОДІЙ ───────────────────────────────────────────────────────
  function setupEvents() {
    // Вкладки: Дерево категорій / Суцільний список
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

    // Розгорнути/Згорнути всі в меню
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

    // Кнопка показу/приховання основного каталогу в суцільному списку
    const btnL3 = document.getElementById('btn-toggle-lvl-3');
    if (btnL3) {
      btnL3.addEventListener('click', () => {
        state.levelVisible[3] = !state.levelVisible[3];
        allNodes.forEach(n => {
          if (!n.is_removal) {
            state.nodeOverrides.delete(n.id);
          }
        });
        updateLevelTogglesUI();
        renderContent();
      });
    }

    // Кнопка для групи перенесення
    const btnTransfer = document.getElementById('btn-toggle-transfer');
    if (btnTransfer) {
      btnTransfer.addEventListener('click', () => {
        state.levelVisible.transfer = !state.levelVisible.transfer;
        allNodes.forEach(n => {
          if (n.is_removal) {
            state.nodeOverrides.delete(n.id);
          }
        });
        updateLevelTogglesUI();
        renderContent();
      });
    }

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

})();
