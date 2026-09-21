/* ============================================================================
   智选云 AI 电商在线售货系统 —— 应用主逻辑（SPA）
   视图：首页 / 分类 / 详情 / 智能选品 / 智能组货 / 智能客服 / 购物车 / 结算
        / 商家中心 / JSON 品类自定义 / 商品管理 / 订单管理
   ============================================================================ */

(function () {
  'use strict';
  const D = window.ZhiXuanData;
  const CE = window.CategoryEngine;
  const AI = window.AiEngine;

  /* ================================================== 工具 */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const fmtPrice = p => '¥' + Number(p || 0).toFixed(2);
  const toast = (msg, type) => {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      padding: '10px 18px', borderRadius: '8px',
      background: type === 'danger' ? '#e74c3c' : type === 'warn' ? '#e67e22' : type === 'success' ? '#27ae60' : '#1f4e79',
      color: '#fff', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,.18)'
    });
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 1800);
    setTimeout(() => t.remove(), 2200);
  };

  /* ================================================== 状态 */
  const State = {
    activeView: 'home',
    selectedCategory: null,
    selectedProduct: null,
    selectedSku: null,
    qty: 1,
    aiChips: [],
    aiChipsIdx: null,
    aiRecommendCache: null,
    csHistory: []
  };

  /* ================================================== 路由 */
  function goto(view, params) {
    State.activeView = view;
    if (params) Object.assign(State, params);
    $$('.app-view').forEach(v => v.classList.remove('active'));
    const t = $('#view-' + view);
    if (t) t.classList.add('active');
    $$('.app-topnav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    if (typeof Views[view] === 'function') Views[view]();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '#home').slice(1).split('/');
    goto(h[0] || 'home');
  });

  /* ================================================== 视图 */
  const Views = {};

  /* ---------- 首页 ---------- */
  Views.home = function () {
    const cats = D.getCategories();
    const products = D.getProducts().filter(p => p.published);
    const profile = D.getProfile();
    /* Hero */
    const heroEl = $('#home-hero');
    heroEl.innerHTML = `
      <h1>智选云 · 你的 AI 购物助手</h1>
      <p class="sub">智能客服 · 智能选品 · 智能组货，三项 AI 能力内建；商品品类由商家用 JSON 自定义，新增品类无需发版。</p>
      <div class="badges">
        <span>🤖 AI 驱动</span>
        <span>🧩 JSON 自定义品类</span>
        <span>🛒 ${products.length} 件商品在售</span>
        <span>📦 ${cats.length} 个品类</span>
      </div>
      <div class="hero-cta">
        <button class="btn" data-go="cs">试试智能客服</button>
        <button class="btn ghost" data-go="recommend">体验 AI 选品</button>
      </div>`;
    $('#home-hero-stats').innerHTML = `
      <div class="hero-stat"><b>${products.length}</b><span>在售商品</span></div>
      <div class="hero-stat"><b>${cats.length}</b><span>品类数</span></div>
      <div class="hero-stat"><b>3</b><span>AI 能力</span></div>
      <div class="hero-stat"><b>${profile.preferredCategories.length}</b><span>画像偏好</span></div>`;
    /* 品类 */
    $('#home-cats').innerHTML = cats.map(c => `
      <div class="cat-tile" data-cat="${esc(c.code)}">
        <span class="emoji">${c.icon || '🏷️'}</span>
        <div class="name">${esc(c.name)}</div>
        <div class="count">${products.filter(p => p.category === c.code).length} 件商品</div>
      </div>`).join('');
    $$('.cat-tile').forEach(el => el.onclick = () => goto('category', { selectedCategory: el.dataset.cat }));
    /* 热门商品 */
    const hot = products.slice().sort((a, b) => b.sales - a.sales).slice(0, 8);
    $('#home-hot').innerHTML = hot.map(p => productCardHtml(p)).join('');
    $$('#home-hot .prod-card').forEach(el => el.onclick = () => goto('product', { selectedProduct: el.dataset.id }));
    /* AI 推荐试看 */
    const rec = AI.recommend({ text: '' });
    State.aiRecommendCache = rec;
    renderAiRecommendSummary($('#home-ai-rec'), rec);
    /* events */
    heroEl.querySelectorAll('[data-go]').forEach(el => el.onclick = () => goto(el.dataset.go));
  };

  function productCardHtml(p) {
    const min = Math.min(...p.skus.map(s => s.salePrice));
    return `
      <div class="prod-card" data-id="${esc(p.productId)}" style="--accent-color: ${p.accentColor}22">
        <div class="prod-cover" style="--accent-color: ${p.accentColor}">
          <span>${p.mainImage}</span>
          <div class="tag-row">${(p.tags || []).slice(0,2).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        </div>
        <div class="prod-body">
          <div class="prod-title">${esc(p.title)}</div>
          <div class="prod-summary">${esc(p.summary)}</div>
          <div class="prod-foot">
            <div class="prod-price">${fmtPrice(min)}</div>
            <div class="prod-rating">⭐ ${p.rating} · ${p.sales} 件已售</div>
          </div>
        </div>
      </div>`;
  }
  function renderAiRecommendSummary(host, rec) {
    if (!rec.ok || !rec.items.length) { host.innerHTML = '<div class="alert info">暂无推荐结果</div>'; return; }
    host.innerHTML = `
      <div class="prod-grid">${rec.items.map(c => `
        <div class="prod-card" data-id="${esc(c.p.productId)}" style="--accent-color: ${c.p.accentColor}">
          <div class="prod-cover" style="--accent-color: ${c.p.accentColor}"><span>${c.p.mainImage}</span></div>
          <div class="prod-body">
            <div class="prod-title">${esc(c.p.title)}</div>
            <div class="prod-summary">💡 ${esc(c.reason)}</div>
            <div class="prod-foot">
              <div class="prod-price">${fmtPrice(Math.min(...c.p.skus.map(s => s.salePrice)))}</div>
              <div class="prod-rating">⭐ ${c.p.rating}</div>
            </div>
          </div>
        </div>`).join('')}
      </div>
      <div style="margin-top: 12px; text-align: right;">
        <button class="btn" id="btn-ai-detail">查看 AI 决策链路 →</button>
      </div>`;
    $$('#home-ai-rec .prod-card').forEach(el => el.onclick = () => goto('product', { selectedProduct: el.dataset.id }));
    $('#btn-ai-detail').onclick = () => showAiProcessModal('智能选品决策链路', rec.log);
  }

  /* ---------- 分类页 ---------- */
  Views.category = function () {
    const cats = D.getCategories();
    const cat = cats.find(c => c.code === State.selectedCategory) || cats[0];
    if (!cat) { goto('home'); return; }
    const allProducts = D.getProducts().filter(p => p.published && p.category === cat.code);
    $('#cat-title').textContent = cat.name;
    $('#cat-count').textContent = allProducts.length + ' 件商品';
    /* 筛选器（动态生成：来自品类 JSON 自定义属性的 filterable 字段）*/
    const filterHost = $('#cat-filters');
    filterHost.innerHTML = cat.attrs.filter(a => a.filterable).map(a => `
      <div class="sku-row" data-attr="${esc(a.attrCode)}">
        <div class="label">${esc(a.attrName)}</div>
        <div class="opts">${a.valueRange.map(v => `<span class="opt" data-val="${esc(v)}">${esc(v)}</span>`).join('')}</div>
      </div>`).join('') || '<div class="muted" style="font-size:13px;">该品类暂无筛选维度</div>';
    /* 选中状态 */
    filterHost.querySelectorAll('.opt').forEach(el => el.onclick = () => {
      el.classList.toggle('active');
      applyCategoryFilter();
    });
    function applyCategoryFilter() {
      const activeFilters = {};
      filterHost.querySelectorAll('.sku-row').forEach(row => {
        const attr = row.dataset.attr;
        const active = Array.from(row.querySelectorAll('.opt.active')).map(x => x.dataset.val);
        if (active.length) activeFilters[attr] = active;
      });
      const filtered = allProducts.filter(p => Object.keys(activeFilters).every(k => activeFilters[k].includes(p[k])));
      renderProds(filtered);
    }
    function renderProds(list) {
      $('#cat-grid').innerHTML = list.length
        ? list.map(p => productCardHtml(p)).join('')
        : '<div class="alert warn">没有匹配筛选条件的商品</div>';
      $$('#cat-grid .prod-card').forEach(el => el.onclick = () => goto('product', { selectedProduct: el.dataset.id }));
    }
    renderProds(allProducts);
  };

  /* ---------- 商品详情 ---------- */
  Views.product = function () {
    const p = D.getProducts().find(x => x.productId === State.selectedProduct);
    if (!p) { goto('home'); return; }
    const cat = D.getCategories().find(c => c.code === p.category);
    $('#pd-crumb').innerHTML = `<a href="#" onclick="event.preventDefault();ZXApp.go('home')">首页</a> · <a href="#" onclick="event.preventDefault();ZXApp.go('category')">${esc(cat.name)}</a> · <span>${esc(p.title)}</span>`;
    $('#pd-cover').style.setProperty('--accent-color', p.accentColor + '66');
    $('#pd-cover').innerHTML = `<span style="font-size:200px;">${p.mainImage}</span>`;
    $('#pd-title').textContent = p.title;
    $('#pd-meta').innerHTML = `<span>⭐ ${p.rating}</span><span>已售 ${p.sales}</span><span>📦 ${p.skus.reduce((s,k)=>s+k.stock,0)} 件现货</span>`;
    $('#pd-desc').textContent = p.summary;
    const min = Math.min(...p.skus.map(s => s.salePrice));
    $('#pd-price').innerHTML = `<b>${fmtPrice(min)}</b><span style="color:#666;font-size:13px;margin-left:8px;">起</span>`;
    /* 动态属性渲染（来自 JSON 品类 Schema）*/
    const attrHost = $('#pd-attrs');
    attrHost.innerHTML = cat.attrs.filter(a => p[a.attrCode]).map(a =>
      `<div style="margin-bottom:10px;"><b style="font-size:13px;color:var(--ink-2);">${esc(a.attrName)}：</b><span style="font-size:13px;">${esc(p[a.attrCode])}</span></div>`
    ).join('');
    /* SKU 渲染 */
    const skuHost = $('#pd-skus');
    State.selectedSku = p.skus[0];
    skuHost.innerHTML = `<div class="label">规格</div><div class="opts">${p.skus.map(s =>
      `<span class="opt ${s.skuId === State.selectedSku.skuId ? 'active' : ''} ${s.stock === 0 ? 'disabled' : ''}" data-sku="${esc(s.skuId)}">${esc(s.specText)} ${s.stock === 0 ? '(缺货)' : ''}</span>`
    ).join('')}</div>`;
    skuHost.querySelectorAll('.opt:not(.disabled)').forEach(el => el.onclick = () => {
      skuHost.querySelectorAll('.opt').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      State.selectedSku = p.skus.find(s => s.skuId === el.dataset.sku);
    });
    State.qty = 1;
    $('#pd-qty').value = '1';
    $('#pd-add-cart').onclick = () => addToCart(p, State.selectedSku, parseInt($('#pd-qty').value, 10));
    $('#pd-buy-now').onclick = () => {
      addToCart(p, State.selectedSku, parseInt($('#pd-qty').value, 10), true);
    };
    /* Tabs */
    $$('#pd-tab-nav .tab').forEach(t => t.onclick = () => {
      $$('#pd-tab-nav .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $$('#pd-tab-pane .tab-pane').forEach(x => x.classList.remove('active'));
      $('#pd-tab-pane-' + t.dataset.tab).classList.add('active');
    });
    $('#pd-tab-pane-detail').innerHTML = `<p>${esc(p.summary)}</p><p style="margin-top:10px;">本品由「智选云」平台直发，享受 7 天无理由退换与一年质保。</p>`;
    /* AI 组货 */
    const bundleRes = AI.composeBundle(p.productId);
    renderBundle($('#pd-bundle'), bundleRes, p);
  };

  function renderBundle(host, res, p) {
    if (!res.ok) { host.innerHTML = ''; return; }
    if (res.degraded) {
      host.innerHTML = `<div class="alert warn"><b>智能组货</b> · ${esc(res.reason)}</div>`;
      return;
    }
    const items = [p, ...res.items];
    host.innerHTML = `
      <div class="bundle-card">
        <h3>✨ ${esc(res.scene)}</h3>
        <div class="scene">${esc(res.reason)}</div>
        <div class="checks">${res.checks.map(c => `<span class="ck ok">✓ ${esc(c.name)}</span>`).join('')}</div>
        <div class="bundle-items">${items.map(i =>
          `<div class="b-item"><span class="emo">${i.mainImage}</span><div><div style="font-weight:700;">${esc(i.title)}</div><div style="color:#b8860b;font-weight:700;">${fmtPrice(Math.min(...i.skus.map(s => s.salePrice)))}</div></div></div>`
        ).join('')}</div>
        <div class="reason">💡 AI 搭配理由：${esc(res.reason)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <div>
            <div style="color:var(--ink-3);font-size:12px;">组合总价</div>
            <div style="color:#b8860b;font-size:24px;font-weight:800;">${fmtPrice(res.bundlePrice)}
              <span style="color:var(--ink-3);font-size:13px;font-weight:400;text-decoration:line-through;margin-left:6px;">${fmtPrice(res.bundlePrice + res.savings)}</span>
            </div>
          </div>
          <button class="btn accent lg" id="btn-bundle-add">一键加入购物车</button>
        </div>
      </div>`;
    $('#btn-bundle-add').onclick = () => {
      items.forEach(it => {
        const p = it.p || it;
        addToCart(p, (it.skus && it.skus[0]) || (p.skus && p.skus[0]) || null, 1, false, true);
      });
      toast('已加入 ' + items.length + ' 件到购物车', 'success');
    };
  }

  /* ---------- 购物车 ---------- */
  Views.cart = function () {
    const cart = D.getCart();
    const host = $('#cart-list');
    if (!cart.length) {
      host.innerHTML = `<div class="card cart-empty">
        <div class="emo">🛒</div>
        <p>购物车空空如也</p>
        <button class="btn primary" onclick="ZXApp.go('home')">去逛逛</button>
      </div>`;
      $('#cart-summary').innerHTML = '';
      return;
    }
    host.innerHTML = `<div class="cart-list">${cart.map((it, idx) => `
      <div class="cart-item" data-idx="${idx}" style="--accent-color: ${it.accentColor}">
        <div class="cover" style="--accent-color: ${it.accentColor}">${it.emoji}</div>
        <div class="info">
          <h4>${esc(it.title)}${it.fromBundle ? '<span class="src-tag">智能组货</span>' : ''}</h4>
          <div class="spec">${esc(it.specText)}</div>
          <div class="price">${fmtPrice(it.price)}</div>
        </div>
        <div class="stepper">
          <button data-act="dec">-</button>
          <input value="${it.qty}" data-qty />
          <button data-act="inc">+</button>
        </div>
        <button class="btn sm danger" data-act="rm">删除</button>
      </div>`).join('')}</div>`;
    $$('.cart-item').forEach(el => {
      const idx = parseInt(el.dataset.idx, 10);
      el.querySelector('[data-act="inc"]').onclick = () => { cart[idx].qty++; D.saveCart(cart); Views.cart(); };
      el.querySelector('[data-act="dec"]').onclick = () => { if (cart[idx].qty > 1) { cart[idx].qty--; D.saveCart(cart); Views.cart(); } };
      el.querySelector('[data-qty]').onchange = (e) => {
        const v = parseInt(e.target.value, 10) || 1;
        cart[idx].qty = Math.max(1, v);
        D.saveCart(cart);
        Views.cart();
      };
      el.querySelector('[data-act="rm"]').onclick = () => {
        cart.splice(idx, 1); D.saveCart(cart); Views.cart();
        toast('已删除');
      };
    });
    const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
    const cnt = cart.reduce((s, it) => s + it.qty, 0);
    $('#cart-summary').innerHTML = `
      <div class="total">共 <b>${cnt}</b> 件，实付：<b>${fmtPrice(total)}</b></div>
      <div style="flex:1"></div>
      <button class="btn" onclick="ZXApp.go('home')">继续购物</button>
      <button class="btn primary lg" id="btn-checkout">去结算</button>`;
    $('#btn-checkout').onclick = () => goto('checkout');
  };

  /* ---------- 结算 ---------- */
  Views.checkout = function () {
    const cart = D.getCart();
    if (!cart.length) { toast('购物车为空', 'warn'); goto('cart'); return; }
    const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
    $('#checkout-items').innerHTML = cart.map(it => `
      <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);">
        <div class="cover" style="width:50px;height:50px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;background:var(--primary-soft);">${it.emoji}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${esc(it.title)}</div>
          <div style="font-size:11px;color:var(--ink-3);">${esc(it.specText)} × ${it.qty}</div>
        </div>
        <div style="color:var(--danger);font-weight:700;">${fmtPrice(it.price * it.qty)}</div>
      </div>`).join('');
    $('#checkout-total').innerHTML = `<b style="color:var(--danger);font-size:22px;">${fmtPrice(total)}</b>`;
    $('#btn-pay').onclick = () => {
      /* 模拟支付回调 */
      const order = {
        orderId: 'O' + D.uid().toUpperCase(),
        items: cart.map(it => ({ ...it })),
        totalAmount: total,
        payAmount: total,
        status: 'PAID',
        statusText: '已支付 / 待发货',
        createdAt: D.now()
      };
      const orders = D.getOrders();
      orders.unshift(order);
      D.saveOrders(orders);
      /* 模拟 AI 行为埋点回流 */
      const profile = D.getProfile();
      cart.forEach(it => {
        profile.preferredCategories = Array.from(new Set([...profile.preferredCategories, it.category]));
        profile.behaviorLog.unshift({ type: 'purchase', skuId: it.skuId, ts: D.now() });
      });
      D.saveProfile(profile);
      D.saveCart([]);
      toast('支付成功！订单 ' + order.orderId, 'success');
      setTimeout(() => goto('orders'), 800);
    };
  };

  /* ---------- 我的订单（消费者视角）---------- */
  Views.orders = function () {
    const orders = D.getOrders();
    const host = $('#orders-list');
    if (!orders.length) {
      host.innerHTML = `<div class="card cart-empty">
        <div class="emo">📦</div>
        <p>暂无订单</p>
        <button class="btn primary" onclick="ZXApp.go('home')">去下单</button>
      </div>`;
      return;
    }
    host.innerHTML = orders.map(o => `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:10px;">
          <div>
            <b style="font-size:14px;">订单号：<code>${esc(o.orderId)}</code></b>
            <span style="margin-left:12px;color:var(--ink-3);font-size:12px;">${esc(o.createdAt)}</span>
          </div>
          <span class="status-pill info">${esc(o.statusText)}</span>
        </div>
        ${o.items.map(i => `
          <div style="display:flex;gap:10px;padding:8px 0;">
            <div style="width:60px;height:60px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:30px;background:var(--primary-soft);">${i.emoji}</div>
            <div style="flex:1;">
              <div style="font-weight:600;">${esc(i.title)}${i.fromBundle ? '<span class="src-tag">智能组货</span>' : ''}</div>
              <div style="font-size:12px;color:var(--ink-3);">${esc(i.specText)} × ${i.qty}</div>
            </div>
            <div style="color:var(--danger);font-weight:700;">${fmtPrice(i.price * i.qty)}</div>
          </div>`).join('')}
        <div style="text-align:right;margin-top:8px;color:var(--ink-2);">
          实付：<b style="color:var(--danger);font-size:18px;">${fmtPrice(o.payAmount)}</b>
        </div>
      </div>`).join('');
  };

  /* ---------- 智能客服 ---------- */
  Views.cs = function () {
    State.csHistory = D.getMessages();
    if (!State.csHistory.length) {
      State.csHistory.push({ role: 'bot', text: '您好，我是智选云 AI 客服小云 🤖\n\n我已准备就绪——您可以咨询订单、查物流、了解智选云的智能选品/智能客服/智能组货能力，或者直接问我：「什么是 JSON 自定义品类」', ts: D.now() });
    }
    renderCsMessages();
    const faqs = D.getKnowledge().slice(0, 8);
    $('#cs-faqs').innerHTML = faqs.map((k, i) => `<div class="qa-item" data-q="${esc(k.q)}">${esc(k.q)}</div>`).join('');
    $('#cs-faqs .qa-item').forEach(el => el.onclick = () => {
      $('#cs-input').value = el.dataset.q;
      sendCsMessage();
    });
    $('#cs-process-log').innerHTML = '';
    /* AI 可观测侧栏：埋点日志 */
    const log = JSON.parse(localStorage.getItem(D.KEYS.aiLog) || '[]');
    $('#cs-trace').innerHTML = log.length ? log.slice(0, 8).map(l => `
      <div style="padding:6px 0;border-bottom:1px solid var(--line);font-size:11px;">
        <div style="color:var(--ink-3);">${esc((l.ts || '').slice(11,19))}</div>
        <div style="font-weight:600;">${esc(l.scene || l.tool || '-')}</div>
        <div style="color:var(--ink-3);">置信度 ${(l.confidence || 0).toFixed(2)}</div>
      </div>`).join('') : '<div style="color:var(--ink-3);font-size:12px;">暂无</div>';
    /* 事件绑定 */
    $('#cs-send').onclick = sendCsMessage;
    $('#cs-input').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCsMessage(); } };
  };

  function sendCsMessage() {
    const input = $('#cs-input');
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    State.csHistory.push({ role: 'user', text, ts: D.now() });
    renderCsMessages();
    /* 调用 AI 引擎 */
    setTimeout(() => {
      const reply = AI.chat(text);
      /* 过程日志 */
      $('#cs-process-log').innerHTML = reply.log.map(s => `<div class="step"><b>${esc(s.stage)}</b> · ${esc(s.detail)}</div>`).join('');
      State.csHistory.push({
        role: 'bot',
        text: reply.text,
        citations: reply.citations || [],
        confidence: reply.confidence,
        degraded: reply.degraded,
        ts: D.now()
      });
      D.saveMessages(State.csHistory);
      AI.logCall({ scene: 'cs', tool: reply.tool || 'rag', confidence: reply.confidence, degraded: reply.degraded, input: text });
      renderCsMessages();
    }, 350);
  }
  function renderCsMessages() {
    const host = $('#cs-stream');
    host.innerHTML = State.csHistory.map(m => {
      if (m.role === 'user') {
        return `<div class="cs-msg user">
          <div class="av">👤</div>
          <div class="bubble">${esc(m.text)}</div>
        </div>`;
      }
      let cite = '';
      if (m.citations && m.citations.length) {
        cite = `<span class="cite">📎 引用：${m.citations.map(c => esc(c.q || c.orderId || '')).filter(Boolean).slice(0,3).join(' / ')}</span>`;
      }
      const conf = m.confidence != null ? `<span class="cite">📊 置信度 ${m.confidence.toFixed(2)}</span>` : '';
      const deg = m.degraded ? `<span class="cite">⚠️ 已降级：${esc(m.degraded ? '低置信度' : '')}</span>` : '';
      return `<div class="cs-msg bot">
        <div class="av">AI</div>
        <div class="bubble">${esc(m.text)}${cite}${conf}${deg}</div>
      </div>`;
    }).join('');
    host.scrollTop = host.scrollHeight;
  }

  /* ---------- 智能选品 ---------- */
  Views.recommend = function () {
    const profile = D.getProfile();
    State.aiChips = ['潮酷数码', '居家焕新', '护肤必备', '送礼清单', '差旅达人', '懒人家电', '运动健康'];
    State.aiChipsIdx = null;
    const chipsHost = $('#ai-chips');
    chipsHost.innerHTML = State.aiChips.map((c, i) => `<span class="chip" data-i="${i}">${esc(c)}</span>`).join('');
    chipsHost.querySelectorAll('.chip').forEach(el => el.onclick = () => {
      chipsHost.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      State.aiChipsIdx = parseInt(el.dataset.i, 10);
      runRecommend();
    });
    function runRecommend() {
      const text = State.aiChipsIdx == null ? '' : State.aiChips[State.aiChipsIdx];
      const rec = AI.recommend({ text });
      State.aiRecommendCache = rec;
      const host = $('#ai-rec-list');
      if (!rec.items.length) { host.innerHTML = '<div class="alert info">暂无匹配推荐</div>'; return; }
      host.innerHTML = `
        <div class="prod-grid">${rec.items.map(c => `
          <div class="prod-card" data-id="${esc(c.p.productId)}" style="--accent-color: ${c.p.accentColor}">
            <div class="prod-cover" style="--accent-color: ${c.p.accentColor}"><span>${c.p.mainImage}</span></div>
            <div class="body" style="padding:12px;">
              <div class="prod-title">${esc(c.p.title)}</div>
              <div class="prod-summary">💡 ${esc(c.reason)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                <div class="prod-price">${fmtPrice(Math.min(...c.p.skus.map(s => s.salePrice)))}</div>
                <div class="prod-rating">来源 ${Array.from(c.source).map(x => ({collab:'协同',semantic:'语义',hot:'热门',fallback:'兜底'}[x]||x)).join('+')}</div>
              </div>
            </div>
          </div>`).join('')}
        </div>`;
      $$('#ai-rec-list .prod-card').forEach(el => el.onclick = () => goto('product', { selectedProduct: el.dataset.id }));
      /* 决策链路 */
      $('#ai-rec-log').innerHTML = rec.log.map(s =>
        `<div style="padding:6px 0;border-bottom:1px dashed var(--line);font-size:12px;"><b style="color:var(--primary);">${esc(s.stage)}</b> · ${esc(s.detail)}</div>`
      ).join('');
      /* 用户画像 */
      const profile = D.getProfile();
      $('#ai-profile').innerHTML = `
        <div style="font-size:13px;line-height:1.8;">
          <div>👤 <b>${esc(profile.nickname)}</b>（${esc(profile.level)}）</div>
          <div>📂 偏好品类：${profile.preferredCategories.map(c => esc((D.getCategories().find(x => x.code === c) || {}).name || c)).join('、')}</div>
          <div>💰 价格偏好：${esc(profile.priceBand)}</div>
          <div>📈 行为事件：${profile.behaviorLog.length} 条</div>
          <div class="alert info" style="margin-top:10px;font-size:11px;">画像由「浏览 / 加购 / 购买」行为实时回流更新</div>
        </div>`;
    }
    runRecommend();
  };

  /* ---------- 商家中心 ---------- */
  Views.merchant = function () {
    $$('.ms-item[data-view]').forEach(el => el.onclick = () => {
      $$('.ms-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      const v = el.dataset.view;
      $$('.merchant-pane').forEach(p => p.classList.remove('active'));
      $('#mp-' + v).classList.add('active');
      if (v === 'products') renderProducts();
      if (v === 'orders') renderOrders();
      if (v === 'category-builder') initCategoryBuilder();
      if (v === 'overview') renderOverview();
    });
    renderOverview();
  };
  function renderOverview() {
    const cats = D.getCategories();
    const products = D.getProducts();
    const orders = D.getOrders();
    $('#mp-overview').innerHTML = `
      <div class="card">
        <h3 class="card-title">经营概览 <small>实时</small></h3>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
          <div style="padding:14px;background:var(--soft);border-radius:8px;"><div style="font-size:12px;color:var(--ink-3);">商品总数</div><div style="font-size:24px;font-weight:800;">${products.length}</div></div>
          <div style="padding:14px;background:var(--soft);border-radius:8px;"><div style="font-size:12px;color:var(--ink-3);">品类数</div><div style="font-size:24px;font-weight:800;">${cats.length}</div></div>
          <div style="padding:14px;background:var(--soft);border-radius:8px;"><div style="font-size:12px;color:var(--ink-3);">订单数</div><div style="font-size:24px;font-weight:800;">${orders.length}</div></div>
          <div style="padding:14px;background:var(--soft);border-radius:8px;"><div style="font-size:12px;color:var(--ink-3);">库存 SKU</div><div style="font-size:24px;font-weight:800;">${products.reduce((s,p)=>s+p.skus.length,0)}</div></div>
        </div>
        <h4 style="margin-top:18px;">品类速览</h4>
        <table class="zt">
          <thead><tr><th>代码</th><th>名称</th><th>层级</th><th>属性数</th><th>商品数</th><th>版本</th></tr></thead>
          <tbody>${cats.map(c => `<tr>
            <td><code>${esc(c.code)}</code></td>
            <td>${c.icon || '🏷️'} ${esc(c.name)}</td>
            <td>L${c.level}</td>
            <td>${c.attrs.length}</td>
            <td>${products.filter(p => p.category === c.code).length}</td>
            <td>v${c.version}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }
  function renderProducts() {
    const products = D.getProducts();
    $('#mp-products').innerHTML = `
      <div class="card">
        <h3 class="card-title">商品管理 <small>${products.length} 件</small></h3>
        <table class="zt">
          <thead><tr><th>商品</th><th>品类</th><th>规格数</th><th>总库存</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${products.map(p => {
            const cat = D.getCategories().find(c => c.code === p.category);
            const total = p.skus.reduce((s, k) => s + k.stock, 0);
            return `<tr>
              <td><span style="font-size:24px;margin-right:6px;">${p.mainImage}</span>${esc(p.title)}</td>
              <td>${esc(cat ? cat.name : '-')}</td>
              <td>${p.skus.length}</td>
              <td>${total}</td>
              <td><span class="status-pill ${p.published ? 'ok' : 'warn'}">${p.published ? '已上架' : '已下架'}</span></td>
              <td>
                <button class="btn sm" data-act="toggle" data-id="${esc(p.productId)}">${p.published ? '下架' : '上架'}</button>
                <button class="btn sm danger" data-act="del" data-id="${esc(p.productId)}">删除</button>
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
        <div style="margin-top:14px;">
          <button class="btn primary" id="btn-add-product">+ 新增商品（动态表单）</button>
        </div>
      </div>`;
    $$('#mp-products [data-act="toggle"]').forEach(b => b.onclick = () => {
      const list = D.getProducts();
      const p = list.find(x => x.productId === b.dataset.id);
      p.published = !p.published;
      D.saveProducts(list);
      toast('已' + (p.published ? '上架' : '下架'));
      renderProducts();
    });
    $$('#mp-products [data-act="del"]').forEach(b => b.onclick = () => {
      if (!confirm('确认删除商品？')) return;
      const list = D.getProducts().filter(x => x.productId !== b.dataset.id);
      D.saveProducts(list);
      toast('已删除', 'warn');
      renderProducts();
    });
    $('#btn-add-product').onclick = openAddProductModal;
  }

  function openAddProductModal() {
    const cats = D.getCategories();
    const host = $('#modal-host');
    host.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div class="card" style="width:100%;max-width:680px;max-height:90vh;overflow:auto;">
          <h3 class="card-title">新增商品 · 表单由所选品类的 JSON Schema 自动生成</h3>
          <div style="margin-bottom:12px;">
            <label style="font-size:13px;color:var(--ink-2);">选择品类</label>
            <select id="np-cat" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:6px;margin-top:4px;">
              ${cats.map(c => `<option value="${esc(c.code)}">${c.icon || '🏷️'} ${esc(c.name)} (${c.attrs.length} 个属性)</option>`).join('')}
            </select>
          </div>
          <div id="np-fields"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:8px;margin-top:12px;">
            <input id="np-title" placeholder="商品标题" style="grid-column:span 5;padding:8px;border:1px solid var(--line);border-radius:6px;" />
            <input id="np-emoji" placeholder="图标 (emoji)" style="padding:8px;border:1px solid var(--line);border-radius:6px;" />
            <input id="np-color" placeholder="主色 (#xxx)" style="padding:8px;border:1px solid var(--line);border-radius:6px;" />
            <input id="np-price" type="number" placeholder="起步价" style="padding:8px;border:1px solid var(--line);border-radius:6px;" />
            <input id="np-stock" type="number" placeholder="初始库存" style="padding:8px;border:1px solid var(--line);border-radius:6px;" />
            <input id="np-spec" placeholder="规格名" style="padding:8px;border:1px solid var(--line);border-radius:6px;" />
          </div>
          <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn" id="np-cancel">取消</button>
            <button class="btn primary" id="np-save">保存</button>
          </div>
        </div>
      </div>`;
    function rebuildFields() {
      const cat = D.getCategories().find(c => c.code === $('#np-cat').value);
      $('#np-fields').innerHTML = cat.attrs.map(a =>
        `<div style="margin-bottom:8px;">
          <label style="font-size:13px;color:var(--ink-2);">${esc(a.attrName)}${a.required ? '<span style="color:var(--danger);">*</span>' : ''}</label>
          ${a.dataType === 'enum' ?
            `<select data-attr="${esc(a.attrCode)}" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:6px;margin-top:4px;">
              <option value="">请选择</option>${a.valueRange.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
            </select>` :
            `<input data-attr="${esc(a.attrCode)}" placeholder="${esc(a.attrName)}" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:6px;margin-top:4px;" />
          `}
        </div>`).join('');
    }
    rebuildFields();
    $('#np-cat').onchange = rebuildFields;
    $('#np-cancel').onclick = () => host.innerHTML = '';
    $('#np-save').onclick = () => {
      const cat = D.getCategories().find(c => c.code === $('#np-cat').value);
      const attrs = {};
      cat.attrs.forEach(a => {
        const el = $(`[data-attr="${a.attrCode}"]`);
        attrs[a.attrCode] = el ? el.value : '';
      });
      const missing = cat.attrs.filter(a => a.required && !attrs[a.attrCode]);
      if (missing.length) { toast('必填项未填：' + missing.map(m => m.attrName).join('、'), 'warn'); return; }
      const title = $('#np-title').value.trim();
      if (!title) { toast('请输入商品标题', 'warn'); return; }
      const pid = 'p' + D.uid().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
      const list = D.getProducts();
      list.push({
        productId: pid,
        sku: 'ZHX-' + pid.toUpperCase(),
        title, category: cat.code, ...attrs,
        mainImage: $('#np-emoji').value || '🛍️',
        accentColor: $('#np-color').value || '#4a90d9',
        summary: title,
        tags: [],
        sales: 0, rating: 5.0,
        skus: [{
          skuId: pid + '-s1',
          specText: $('#np-spec').value || '标准款',
          salePrice: parseFloat($('#np-price').value) || 99,
          stock: parseInt($('#np-stock').value, 10) || 100
        }],
        published: true
      });
      D.saveProducts(list);
      host.innerHTML = '';
      toast('已新增：' + title, 'success');
      renderProducts();
    };
  }

  function renderOrders() {
    const orders = D.getOrders();
    if (!orders.length) {
      $('#mp-orders').innerHTML = '<div class="card"><div class="alert info">暂无订单</div></div>';
      return;
    }
    $('#mp-orders').innerHTML = `
      <div class="card">
        <h3 class="card-title">订单管理 <small>${orders.length} 个</small></h3>
        <table class="zt">
          <thead><tr><th>订单号</th><th>商品</th><th>金额</th><th>状态</th><th>下单时间</th></tr></thead>
          <tbody>${orders.map(o => `
            <tr>
              <td><code>${esc(o.orderId)}</code></td>
              <td>${o.items.map(i => esc(i.title)).join('、')}</td>
              <td style="color:var(--danger);font-weight:700;">${fmtPrice(o.payAmount)}</td>
              <td><span class="status-pill ${o.status === 'PAID' ? 'info' : 'ok'}">${esc(o.statusText)}</span></td>
              <td>${esc(o.createdAt)}</td>
            </tr>`).join('')}
        </tbody></table>
      </div>`;
  }

  /* ---------- JSON 品类自定义引擎 ---------- */
  let _catBuilderReady = false;
  function initCategoryBuilder() {
    if (_catBuilderReady) return;
    _catBuilderReady = true;
    /* 模板 */
    const templates = {
      digital: {
        code: 'cat_custom_digital', name: '可穿戴设备', icon: '⌚',
        path: '/可穿戴设备', level: 1,
        attrs: [
          { attrCode: 'brand',    attrName: '品牌',     dataType: 'enum',   required: true,  filterable: true,  valueRange: ['Apple','华为','小米','OPPO','Vivo','三星'] },
          { attrCode: 'battery',  attrName: '续航(天)', dataType: 'int',    required: false, filterable: true,  valueRange: [] },
          { attrCode: 'waterproof',attrName: '防水等级',dataType: 'enum',   required: false, filterable: true,  valueRange: ['IP67','IP68','IPX5','无'] }
        ]
      },
      food: {
        code: 'cat_custom_food', name: '休闲零食', icon: '🍪',
        path: '/休闲零食', level: 1,
        attrs: [
          { attrCode: 'flavor',   attrName: '口味',     dataType: 'enum',   required: true,  filterable: true,  valueRange: ['原味','辣味','甜味','咸味','混合'] },
          { attrCode: 'weight',   attrName: '净含量',   dataType: 'string', required: true,  filterable: true,  valueRange: [] },
          { attrCode: 'organic',  attrName: '有机认证', dataType: 'bool',   required: false, filterable: true,  valueRange: ['是','否'] }
        ]
      }
    };
    $('#ce-tpl-digital').onclick = () => { $('#ce-editor').value = JSON.stringify(templates.digital, null, 2); };
    $('#ce-tpl-food').onclick = () => { $('#ce-editor').value = JSON.stringify(templates.food, null, 2); };
    $('#ce-clear').onclick = () => { $('#ce-editor').value = ''; };
    $('#ce-execute').onclick = executeCategoryImport;
    /* Tabs */
    $$('#ce-tab-nav .t').forEach(t => t.onclick = () => {
      $$('#ce-tab-nav .t').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $$('#ce-tab-pane').forEach(p => p.classList.remove('active'));
      $('#ce-pane-' + t.dataset.tab).classList.add('active');
    });
  }
  function executeCategoryImport() {
    const txt = $('#ce-editor').value;
    const existing = D.getCategories();
    const result = CE.importCategory(txt, existing);
    /* 渲染过程 */
    const host = $('#ce-process');
    host.innerHTML = '';
    result.log.forEach(s => {
      const step = document.createElement('div');
      step.className = 'ce-step ' + s.status;
      let body = `<b>${s.name}</b><span>${s.status === 'ok' ? '✓ 通过' : s.status === 'fail' ? '✗ 失败' : '⏳ 处理中'}</span>`;
      if (s.error) body += `<pre>${esc(s.error)}\n${esc(s.snippet || '')}</pre>`;
      if (s.issues) body += s.issues.map(i => `<div style="color:${i.level==='error'?'#dc3545':'#856404'};">· [${i.level === 'error' ? '错误' : '警告'}] ${esc(i.msg)}</div>`).join('');
      if (s.added) body += `<div style="margin-top:4px;color:var(--accent);">✓ 已写入 <code>${esc(s.added.code)}</code> (v${s.added.version})</div>`;
      if (s.formFields) body += `<div style="margin-top:4px;color:var(--accent);">✓ 已生成 <code>${s.formFields}</code> 个动态表单字段</div>`;
      if (s.indexFilterable) body += `<div style="margin-top:4px;color:var(--accent);">✓ 已映射 <code>${s.indexFilterable}</code> 个可筛选维度</div>`;
      step.innerHTML = `<div class="marker">${s.step}</div><div class="body">${body}</div>`;
      host.appendChild(step);
    });
    if (result.ok) {
      D.saveCategories(result.nodes);
      renderDerived(result.derived);
      $('#ce-pane-form').classList.add('active');
      /* 默认切到表单预览 */
      $$('#ce-tab-nav .t').forEach(x => x.classList.remove('active'));
      $$('#ce-tab-nav .t[data-tab="form"]')[0].classList.add('active');
      $$('#ce-tab-pane').forEach(p => p.classList.remove('active'));
      $('#ce-pane-form').classList.add('active');
      toast('品类发布成功！可在「动态表单/索引/AI提示词」查看衍生产物', 'success');
    } else {
      toast('导入失败：' + (result.log.find(s => s.status === 'fail')?.name || ''), 'danger');
    }
  }
  function renderDerived(d) {
    $('#ce-form-preview').innerHTML = d.formSchema.fields.map(f => `
      <div class="form-field">
        <div class="l">${esc(f.label)}${f.required ? '<span class="req">*</span>' : ''}</div>
        <div class="v">${esc(f.dataType)} · 控件: ${esc(f.control)}${f.filterable ? ' · <span class="flt">可筛选</span>' : ''}${f.options.length ? ' · 选项 ' + f.options.length : ''}</div>
      </div>`).join('');
    $('#ce-index-preview').textContent = JSON.stringify(d.indexMapping, null, 2);
    $('#ce-prompt-preview').textContent = d.promptContext;
  }

  /* ================================================== 辅助：加购 */
  function addToCart(p, sku, qty, then, fromBundle) {
    if (!sku) sku = p.skus[0];
    qty = Math.max(1, qty || 1);
    const cart = D.getCart();
    const exist = cart.find(c => c.skuId === sku.skuId);
    if (exist) exist.qty += qty;
    else cart.push({
      skuId: sku.skuId, productId: p.productId, category: p.category,
      title: p.title, specText: sku.specText, price: sku.salePrice,
      qty, emoji: p.mainImage, accentColor: p.accentColor,
      fromBundle: !!fromBundle
    });
    D.saveCart(cart);
    updateCartBadge();
    if (!then && !fromBundle) toast('已加入购物车', 'success');
    if (then) goto('cart');
  }
  function updateCartBadge() {
    const cnt = D.getCart().reduce((s, it) => s + it.qty, 0);
    $('#cart-badge').textContent = cnt;
    $('#cart-badge').style.display = cnt ? 'inline-flex' : 'none';
  }

  /* ================================================== 弹窗 */
  function showAiProcessModal(title, log) {
    const host = $('#modal-host');
    host.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)ZXApp.closeModal()">
        <div class="card" style="width:100%;max-width:540px;max-height:80vh;overflow:auto;">
          <h3 class="card-title">${esc(title)}</h3>
          <div style="font-family:var(--mono);font-size:13px;">
            ${log.map(s => `<div style="padding:6px 0;border-bottom:1px dashed var(--line);"><b style="color:var(--primary);">▶ ${esc(s.stage)}</b><br/>${esc(s.detail)}</div>`).join('')}
          </div>
          <div style="text-align:right;margin-top:14px;">
            <button class="btn primary" onclick="ZXApp.closeModal()">关闭</button>
          </div>
        </div>
      </div>`;
  }

  /* ================================================== 启动 */
  function boot() {
    D.init();
    /* 顶栏点击 */
    $$('.app-topnav a[data-view]').forEach(el => el.onclick = e => {
      e.preventDefault();
      goto(el.dataset.view);
    });
    /* 商品数量步进 */
    $('#pd-qty-dec').onclick = () => { State.qty = Math.max(1, State.qty - 1); $('#pd-qty').value = State.qty; };
    $('#pd-qty-inc').onclick = () => { State.qty++; $('#pd-qty').value = State.qty; };
    /* 购物车步进等内联 onclick 通过 ZXApp.go 调用 */
    window.ZXApp = {
      go: (v) => goto(v),
      closeModal: () => $('#modal-host').innerHTML = ''
    };
    /* hash 路由 */
    const h = (location.hash || '#home').slice(1).split('/');
    goto(h[0] || 'home');
    updateCartBadge();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();