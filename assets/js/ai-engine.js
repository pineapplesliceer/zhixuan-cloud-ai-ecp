/* ============================================================================
   智选云 AI 电商在线售货系统 —— AI 能力引擎（客户端模拟实现）
   对应设计报告：
     - 智能客服：意图分流 → 知识检索增强 / 业务工具调用 → 流式答复
     - 智能选品：画像 → 多路召回 → 精排 → 业务规则过滤 → 多样性重排 → 兜底
     - 智能组货：场景识别 → 配套召回 → 四维可行性校验 → 组合定价 → 方案生成
   ============================================================================ */

window.AiEngine = (function () {
  'use strict';
  const Data = window.ZhiXuanData;

  /* ===================================================== */
  /* 1) 智能客服：意图分流 + RAG 检索增强 + 工具调用        */
  /* ===================================================== */
  function chat(userText, ctx) {
    ctx = ctx || {};
    const log = [];
    const t = (userText || '').trim();
    log.push({ stage: '输入理解', detail: '收到用户提问：' + (t || '(空)') });
    /* ---- 1.1 工具调用（业务事实型问题）---- */
    const toolIntent = matchToolIntent(t);
    if (toolIntent) {
      log.push({ stage: '意图分流', detail: '识别为业务事实型问题，路由到「' + toolIntent.tool + '」受控工具调用' });
      const result = invokeTool(toolIntent, ctx);
      log.push({ stage: '工具调用', detail: '调用 ' + toolIntent.tool + '(' + JSON.stringify(toolIntent.args) + ')' });
      log.push({ stage: '生成答复', detail: '基于工具真实结果组装答案' });
      const reply = {
        text: result.text,
        intent: 'tool',
        tool: toolIntent.tool,
        confidence: 0.92,
        degraded: false,
        citations: result.citations || [],
        log
      };
      return reply;
    }
    /* ---- 1.2 RAG 检索增强 ---- */
    log.push({ stage: '意图分流', detail: '识别为知识咨询型问题，路由到 RAG 检索增强生成' });
    const kb = Data.getKnowledge();
    const hits = ragSearch(t, kb, 3);
    log.push({ stage: '向量检索', detail: '对知识库执行语义检索，命中 ' + hits.length + ' 条相关条目' });
    hits.forEach((h, i) => log.push({ stage: 'Top-' + (i + 1), detail: h.q + ' (相似度 ' + h.score.toFixed(2) + ')' }));
    if (hits.length === 0) {
      log.push({ stage: '安全护栏', detail: '置信度 < 0.30，触发转人工兜底' });
      return {
        text: '暂未在知识库中找到准确答案。为避免误导，建议您转接人工客服。您可以简单描述问题，或拨打 400-000-0000。',
        intent: 'fallback',
        confidence: 0.21,
        degraded: true,
        degradeReason: 'low_confidence',
        log
      };
    }
    const top = hits[0];
    log.push({ stage: '提示词组装', detail: 'system: 你是智选云智能客服；context: ' + top.q });
    log.push({ stage: '流式生成', detail: '调用 LLM 网关（模拟）生成答复' });
    log.push({ stage: '安全护栏', detail: '内容检测通过 (top.score=' + top.score.toFixed(2) + ')' });
    return {
      text: top.a,
      intent: 'rag',
      citations: hits.map(h => ({ q: h.q, score: h.score })),
      confidence: top.score,
      degraded: false,
      log
    };
  }

  function matchToolIntent(text) {
    /* 业务事实型：订单查询、库存查询、物流查询 */
    const rules = [
      { re: /订单\s*(?:编号|#)?\s*([A-Za-z0-9-]{4,})/, tool: 'order_query',  args: (m) => ({ orderId: m[1] }) },
      { re: /(?:查|看|我的).*订单/, tool: 'order_query', args: () => ({ orderId: '*' }) },
      { re: /(?:现货|有货|库存).*?(p\d+)/, tool: 'inventory_query', args: (m) => ({ productId: m[1] }) },
      { re: /物流.*?([A-Za-z0-9-]{4,})/, tool: 'logistics_query', args: (m) => ({ trackingNo: m[1] }) }
    ];
    for (const r of rules) {
      const m = r.re.exec(text);
      if (m) return { tool: r.tool, args: r.args(m) };
    }
    return null;
  }

  function invokeTool(intent, ctx) {
    if (intent.tool === 'order_query') {
      const orders = Data.getOrders();
      const list = intent.args.orderId === '*'
        ? orders
        : orders.filter(o => o.orderId === intent.args.orderId || o.orderId.includes(intent.args.orderId));
      if (list.length === 0) {
        return { text: '未找到订单' + (intent.args.orderId === '*' ? '（当前账号暂无订单）' : '：' + intent.args.orderId) + '。请确认订单号是否正确。' };
      }
      const text = list.slice(0, 3).map(o => {
        const skus = o.items.map(i => i.title).join('、');
        return '· 订单 ' + o.orderId + '｜' + o.statusText + '｜¥' + o.payAmount.toFixed(2) + '｜' + skus;
      }).join('\n');
      return { text: '已为您查询到 ' + list.length + ' 个订单：\n' + text, citations: list.map(o => ({ orderId: o.orderId })) };
    }
    if (intent.tool === 'inventory_query') {
      const p = Data.getProducts().find(x => x.productId === intent.args.productId);
      if (!p) return { text: '未找到商品 ' + intent.args.productId };
      const total = p.skus.reduce((s, k) => s + k.stock, 0);
      return { text: p.title + ' 当前总库存 ' + total + ' 件，分规格：' + p.skus.map(k => k.specText + ' ' + k.stock + '件').join(' / ') };
    }
    if (intent.tool === 'logistics_query') {
      return { text: '运单 ' + intent.args.trackingNo + '：运输中 —— 已到达【杭州转运中心】，预计 24 小时内送达。' };
    }
    return { text: '工具调用失败' };
  }

  function ragSearch(query, kb, topK) {
    if (!query) return [];
    const tokens = query.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean);
    const scored = kb.map(item => {
      let score = 0;
      item.tags.forEach(tag => {
        if (query.includes(tag)) score += 1.0;
        else tokens.forEach(tk => { if (tag.toLowerCase().includes(tk)) score += 0.3; });
      });
      if (query.includes(item.q.slice(0, 2))) score += 0.5;
      return Object.assign({}, item, { score });
    });
    return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /* ===================================================== */
  /* 2) 智能选品：画像 → 多路召回 → 精排 → 过滤 → 重排      */
  /* ===================================================== */
  function recommend(ctx) {
    ctx = ctx || {};
    const log = [];
    const products = Data.getProducts().filter(p => p.published);
    const profile = Data.getProfile();
    log.push({ stage: '画像装载', detail: '用户 ' + profile.nickname + '，偏好品类 ' + profile.preferredCategories.length + ' 个' });
    /* ---- 2.1 多路召回 ---- */
    const candidates = new Map();
    /* (a) 协同召回：同偏好品类商品（去重）*/
    const collab = products.filter(p => profile.preferredCategories.includes(p.category));
    collab.forEach(p => candidates.set(p.productId, { p, source: new Set(['collab']), score: 0 }));
    /* (b) 语义召回：标签匹配 */
    const ctxText = (ctx.text || '').toLowerCase();
    const semantic = products.filter(p =>
      p.tags.some(t => ctxText.includes(t)) ||
      p.title.toLowerCase().includes(ctxText) ||
      p.summary.toLowerCase().includes(ctxText)
    );
    semantic.forEach(p => {
      if (candidates.has(p.productId)) candidates.get(p.productId).source.add('semantic');
      else candidates.set(p.productId, { p, source: new Set(['semantic']), score: 0 });
    });
    /* (c) 热门召回：销量 Top N */
    const hot = products.slice().sort((a, b) => b.sales - a.sales).slice(0, 6);
    hot.forEach(p => {
      if (candidates.has(p.productId)) candidates.get(p.productId).source.add('hot');
      else candidates.set(p.productId, { p, source: new Set(['hot']), score: 0 });
    });
    log.push({ stage: '多路召回', detail: '协同 ' + collab.length + ' 条 / 语义 ' + semantic.length + ' 条 / 热门 ' + hot.length + ' 条，合并去重 ' + candidates.size + ' 条' });
    /* ---- 2.2 精排打分 ---- */
    candidates.forEach(c => {
      const p = c.p;
      let score = 0;
      /* 多路命中加权 */
      score += c.source.size * 0.5;
      /* 品类偏好 */
      if (profile.preferredCategories.includes(p.category)) score += 1.2;
      /* 评分归一化（0~1） */
      score += (p.rating - 4) * 1.5;
      /* 销量归一化 */
      score += Math.log10(p.sales + 1) * 0.4;
      /* 库存可用性 */
      const avail = p.skus.reduce((s, k) => s + k.stock, 0);
      if (avail < 30) score -= 0.4;
      c.score = score;
    });
    /* ---- 2.3 业务规则过滤 ---- */
    const filtered = [];
    candidates.forEach(c => {
      const reasons = [];
      const avail = c.p.skus.reduce((s, k) => s + k.stock, 0);
      if (!c.p.published) reasons.push('已下架');
      if (avail === 0) reasons.push('缺货');
      if (reasons.length === 0) filtered.push(c); else c.rejectReason = reasons.join('，');
    });
    log.push({ stage: '业务过滤', detail: '通过 ' + filtered.length + ' 条，拦截 ' + (candidates.size - filtered.length) + ' 条' });
    /* ---- 2.4 多样性重排（同一品类最多保留 2 个）---- */
    const catCount = {};
    const reranked = [];
    filtered.sort((a, b) => b.score - a.score).forEach(c => {
      catCount[c.p.category] = catCount[c.p.category] || 0;
      if (catCount[c.p.category] < 2) {
        reranked.push(c);
        catCount[c.p.category]++;
      }
    });
    /* ---- 2.5 冷启动兜底（不足 4 条时补全）---- */
    if (reranked.length < 4) {
      const need = 4 - reranked.length;
      const taken = new Set(reranked.map(c => c.p.productId));
      const fallback = products.filter(p => !taken.has(p.productId)).slice(0, need);
      fallback.forEach(p => reranked.push({ p, source: new Set(['fallback']), score: 0, fallback: true }));
      log.push({ stage: '冷启动兜底', detail: '补充 ' + fallback.length + ' 条热门兜底商品' });
    }
    log.push({ stage: '多样性重排', detail: '最终排序：' + reranked.slice(0, 6).map(c => c.p.title).join(' / ') });
    /* ---- 2.6 生成推荐理由 ---- */
    reranked.slice(0, 6).forEach(c => {
      c.reason = generateReason(c, profile, ctx);
    });
    return { ok: true, log, items: reranked.slice(0, 6) };
  }

  function generateReason(c, profile, ctx) {
    const sources = Array.from(c.source);
    if (c.fallback) return '热门商品，本周关注度较高';
    if (sources.includes('semantic') && ctx.text) return '与您搜索「' + ctx.text + '」相关';
    if (sources.includes('collab')) return '根据您过往在「' + catNameOf(c.p.category) + '」的浏览偏好推荐';
    if (c.p.rating >= 4.8) return '好评率 ' + (c.p.rating * 20).toFixed(0) + '%，近 30 天口碑领先';
    if (c.p.sales > 5000) return '已售 ' + c.p.sales + ' 件，热销榜单常驻';
    return '系统根据您的画像生成的个性化推荐';
  }
  function catNameOf(code) {
    const c = Data.getCategories().find(x => x.code === code);
    return c ? c.name : '该品类';
  }

  /* ===================================================== */
  /* 3) 智能组货：场景识别 → 配套召回 → 可行性校验 → 输出   */
  /* ===================================================== */
  function composeBundle(productId) {
    const log = [];
    const products = Data.getProducts();
    const main = products.find(p => p.productId === productId);
    if (!main) return { ok: false, log: [{ stage: '错误', detail: '找不到主商品 ' + productId }] };
    const rules = Data.getBundleRules();
    /* 1) 场景识别（基于关联规则引擎）*/
    log.push({ stage: '场景识别', detail: '主商品：' + main.title + '（' + main.productId + '）' });
    const rule = rules.find(r => r.mainSku.startsWith(main.productId));
    if (!rule) {
      log.push({ stage: '配套召回', detail: '未找到适配的搭配规则，降级为单品推荐' });
      return { ok: true, degraded: true, reason: '未找到搭配规则，已降级为单品推荐', main, items: [], log };
    }
    log.push({ stage: '场景识别', detail: '识别购物场景：' + rule.scene });
    /* 2) 配套召回 */
    const companion = rule.items.map(skuIdPrefix => {
      const pid = skuIdPrefix.split('-')[0];
      return products.find(p => p.productId === pid);
    }).filter(Boolean);
    log.push({ stage: '配套召回', detail: '召回 ' + companion.length + ' 件配套商品：' + companion.map(c => c.title).join(' / ') });
    /* 3) 四维可行性校验：库存 / 履约 / 毛利 */
    const checks = [];
    /* (a) 库存校验 */
    const stockOk = main.skus.some(s => s.stock > 0) && companion.every(c => c.skus.some(s => s.stock > 0));
    checks.push({ name: '库存可用性', ok: stockOk, detail: stockOk ? '主商品与配套商品均有现货' : '存在缺货规格' });
    /* (b) 价格区间合理（不超主商品 5 倍）*/
    const mainMin = Math.min(...main.skus.map(s => s.salePrice));
    const companionMax = Math.max(...companion.flatMap(c => c.skus.map(s => s.salePrice)));
    const priceOk = companionMax <= mainMin * 5;
    checks.push({ name: '价格合理性', ok: priceOk, detail: '主商品 ¥' + mainMin + ' / 配套最高 ¥' + companionMax });
    /* (c) 履约能力（全部由智选云直发）*/
    const logisticsOk = true;
    checks.push({ name: '履约能力', ok: logisticsOk, detail: '全部商品由智选云直发，可合并发货' });
    /* (d) 毛利测算（毛利率 >= 12%）*/
    const totalMin = mainMin + companion.reduce((s, c) => s + Math.min(...c.skus.map(x => x.salePrice)), 0);
    const grossRate = 0.18;
    const grossOk = grossRate >= 0.12;
    checks.push({ name: '毛利测算', ok: grossOk, detail: '组合毛利率 ' + (grossRate * 100).toFixed(1) + '%（阈值 ≥ 12%）' });
    log.push({ stage: '可行性校验', detail: '四维校验：' + checks.map(c => (c.ok ? '✅' : '❌') + c.name).join(' ') });
    /* 4) 生成组合 */
    const allOk = checks.every(c => c.ok);
    if (!allOk) {
      log.push({ stage: '方案输出', detail: '四维校验未全部通过，降级为单品推荐' });
      return { ok: true, degraded: true, reason: '可行性校验未全部通过，已降级为单品推荐', main, items: [], log, checks };
    }
    log.push({ stage: '组合定价', detail: '组合总价 ¥' + totalMin + '（较单买节省 ¥' + Math.round(totalMin * 0.1) + '）' });
    log.push({ stage: '生成搭配理由', detail: '调用大模型（模拟）生成搭配理由' });
    return {
      ok: true, degraded: false,
      main, items: companion,
      scene: rule.scene,
      reason: rule.reason,
      bundlePrice: totalMin,
      savings: Math.round(totalMin * 0.1),
      checks,
      log
    };
  }

  /* ===================================================== */
  /* 4) AI 调用埋点（用于可观测与日志记录）                  */
  /* ===================================================== */
  function logCall(record) {
    const KEY = Data.KEYS.aiLog;
    const log = JSON.parse(localStorage.getItem(KEY) || '[]');
    log.unshift(Object.assign({ ts: Data.now() }, record));
    localStorage.setItem(KEY, JSON.stringify(log.slice(0, 200)));
    return record;
  }

  return { chat, recommend, composeBundle, logCall };
})();