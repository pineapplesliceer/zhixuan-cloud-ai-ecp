/* ============================================================================
   智选云 AI 电商在线售货系统 —— 基础数据
   - 商品库 / 品类树（JSON 自定义示例）/ SKU / 库存 / 用户画像 / 知识库
   - 数据持久化于 localStorage
   ============================================================================ */

window.ZhiXuanData = (function () {
  'use strict';

  /* ---------- 内置可调用的工具方法 ---------- */
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const now = () => new Date().toISOString();

  /* ---------- 默认品类定义（JSON 形式 - 模拟商家通过 JSON 自定义品类）*/
  /* 该数据结构与设计报告 3.6 节中描述的 JSON 规范一致：
     code/name/path/level + attrs[] 数组（含 dataType/required/filterable/valueRange）*/
  const DEFAULT_CATEGORIES = [
    {
      code: 'cat_digital',
      name: '数码潮玩',
      icon: '🎧',
      path: '/数码潮玩',
      level: 1,
      parent: null,
      attrs: [
        { attrCode: 'brand',     attrName: '品牌',     dataType: 'enum',   required: true,  filterable: true,  valueRange: ['Apple','华为','小米','Sony','JBL','Bose','大疆','罗技'] },
        { attrCode: 'color',     attrName: '颜色',     dataType: 'enum',   required: false, filterable: true,  valueRange: ['星空黑','月光银','冰川蓝','薄荷绿','樱花粉','深空灰'] },
        { attrCode: 'warranty',  attrName: '保修期',   dataType: 'enum',   required: false, filterable: true,  valueRange: ['一年','两年','三年'] }
      ]
    },
    {
      code: 'cat_home',
      name: '家居生活',
      icon: '🏠',
      path: '/家居生活',
      level: 1,
      parent: null,
      attrs: [
        { attrCode: 'material',  attrName: '材质',     dataType: 'enum',   required: true,  filterable: true,  valueRange: ['实木','板材','金属','布艺','陶瓷','玻璃'] },
        { attrCode: 'style',     attrName: '风格',     dataType: 'enum',   required: false, filterable: true,  valueRange: ['现代简约','北欧风','新中式','工业风','日式'] },
        { attrCode: 'install',   attrName: '安装方式', dataType: 'enum',   required: false, filterable: false, valueRange: ['免安装','需简单安装','专业安装'] }
      ]
    },
    {
      code: 'cat_appliance',
      name: '智能家电',
      icon: '🔌',
      path: '/智能家电',
      level: 1,
      parent: null,
      attrs: [
        { attrCode: 'energy',    attrName: '能效等级', dataType: 'enum',   required: true,  filterable: true,  valueRange: ['一级','二级','三级'] },
        { attrCode: 'capacity',  attrName: '容量',     dataType: 'string', required: false, filterable: true,  valueRange: [] },
        { attrCode: 'smart',     attrName: '智能联动', dataType: 'bool',   required: false, filterable: true,  valueRange: ['是','否'] }
      ]
    },
    {
      code: 'cat_beauty',
      name: '美妆个护',
      icon: '💄',
      path: '/美妆个护',
      level: 1,
      parent: null,
      attrs: [
        { attrCode: 'skinType',  attrName: '适用肤质', dataType: 'enum',   required: false, filterable: true,  valueRange: ['干性','油性','混合性','敏感性','所有肤质'] },
        { attrCode: 'volume',    attrName: '规格',     dataType: 'string', required: true,  filterable: true,  valueRange: [] },
        { attrCode: 'origin',    attrName: '产地',     dataType: 'enum',   required: false, filterable: false, valueRange: ['中国','法国','日本','韩国','美国'] }
      ]
    }
  ];

  /* ---------- 商品数据（每件商品关联到品类，由品类属性 Schema 自动渲染发布表单）*/
  const DEFAULT_PRODUCTS = [
    // 数码潮玩
    {
      productId: 'p001', sku: 'ZHX-AUDIO-001',
      title: '无线蓝牙降噪耳机 Pro',
      category: 'cat_digital',
      brand: 'Sony', color: '星空黑', warranty: '两年',
      mainImage: '🎧', accentColor: '#3b82f6',
      summary: 'Hi-Res 高解析音质 · 主动降噪 · 续航 30 小时',
      tags: ['降噪','通勤','音乐'],
      sales: 8420, rating: 4.8,
      skus: [
        { skuId: 'p001-s1', specText: '星空黑 / 标配',     salePrice: 1299, stock: 156 },
        { skuId: 'p001-s2', specText: '月光银 / 标配',     salePrice: 1299, stock: 88 },
        { skuId: 'p001-s3', specText: '星空黑 / 尊享套装', salePrice: 1599, stock: 42 }
      ],
      published: true
    },
    {
      productId: 'p002', sku: 'ZHX-AUDIO-002',
      title: '便携蓝牙音箱 Mini',
      category: 'cat_digital',
      brand: 'JBL', color: '冰川蓝', warranty: '一年',
      mainImage: '🔊', accentColor: '#06b6d4',
      summary: 'IPX7 级防水 · 12 小时续航 · 360° 环绕立体声',
      tags: ['户外','派对','防水'],
      sales: 5320, rating: 4.7,
      skus: [
        { skuId: 'p002-s1', specText: '冰川蓝', salePrice: 599, stock: 220 },
        { skuId: 'p002-s2', specText: '薄荷绿', salePrice: 599, stock: 180 },
        { skuId: 'p002-s3', specText: '星空黑', salePrice: 599, stock: 95 }
      ],
      published: true
    },
    {
      productId: 'p003', sku: 'ZHX-CAM-003',
      title: '口袋云台相机 4K',
      category: 'cat_digital',
      brand: '大疆', color: '深空灰', warranty: '两年',
      mainImage: '📷', accentColor: '#6366f1',
      summary: '三轴机械增稳 · 4K/60fps · AI 一键剪辑',
      tags: ['Vlog','旅拍','运动'],
      sales: 3210, rating: 4.9,
      skus: [
        { skuId: 'p003-s1', specText: '标准套装', salePrice: 2499, stock: 65 },
        { skuId: 'p003-s2', specText: '全能套装', salePrice: 2999, stock: 38 }
      ],
      published: true
    },
    {
      productId: 'p004', sku: 'ZHX-WATCH-004',
      title: '智能运动手表 X',
      category: 'cat_digital',
      brand: '华为', color: '星空黑', warranty: '一年',
      mainImage: '⌚', accentColor: '#10b981',
      summary: '14 天续航 · 100+ 运动模式 · 鸿蒙生态',
      tags: ['运动','健康','商务'],
      sales: 12450, rating: 4.8,
      skus: [
        { skuId: 'p004-s1', specText: '标准版 46mm', salePrice: 1499, stock: 320 },
        { skuId: 'p004-s2', specText: '尊享版 46mm', salePrice: 1999, stock: 150 }
      ],
      published: true
    },

    // 智能家电
    {
      productId: 'p005', sku: 'ZHX-AC-005',
      title: '一级能效变频空调',
      category: 'cat_appliance',
      energy: '一级', capacity: '1.5匹', smart: '是',
      mainImage: '❄️', accentColor: '#0ea5e9',
      summary: '新一级能效 · 智能温感 · 静音运行 18 分贝',
      tags: ['节能','智能','静音'],
      sales: 6520, rating: 4.8,
      skus: [
        { skuId: 'p005-s1', specText: '壁挂式 / 1匹',  salePrice: 2399, stock: 80 },
        { skuId: 'p005-s2', specText: '壁挂式 / 1.5匹', salePrice: 2899, stock: 120 },
        { skuId: 'p005-s3', specText: '壁挂式 / 2匹',  salePrice: 3699, stock: 45 }
      ],
      published: true
    },
    {
      productId: 'p006', sku: 'ZHX-WM-006',
      title: '滚筒洗烘一体机',
      category: 'cat_appliance',
      energy: '一级', capacity: '10kg', smart: '是',
      mainImage: '🧺', accentColor: '#8b5cf6',
      summary: '10kg 大容量 · 洗烘一体 · AI 智能投放',
      tags: ['大容量','洗烘一体','智能'],
      sales: 4120, rating: 4.7,
      skus: [
        { skuId: 'p006-s1', specText: '10kg / 月光银', salePrice: 3599, stock: 60 },
        { skuId: 'p006-s2', specText: '10kg / 星空黑', salePrice: 3599, stock: 40 }
      ],
      published: true
    },
    {
      productId: 'p007', sku: 'ZHX-RB-007',
      title: '扫拖一体机器人',
      category: 'cat_appliance',
      energy: '二级', capacity: '0.4L', smart: '是',
      mainImage: '🤖', accentColor: '#a855f7',
      summary: 'LDS 激光导航 · 扫拖一体 · 110 分钟续航',
      tags: ['懒人神器','扫地','拖地'],
      sales: 8920, rating: 4.6,
      skus: [
        { skuId: 'p007-s1', specText: '标准版', salePrice: 1799, stock: 200 },
        { skuId: 'p007-s2', specText: '全自动集尘版', salePrice: 2599, stock: 80 }
      ],
      published: true
    },

    // 家居生活
    {
      productId: 'p008', sku: 'ZHX-SOFA-008',
      title: '北欧风布艺沙发',
      category: 'cat_home',
      material: '布艺', style: '北欧风', install: '需简单安装',
      mainImage: '🛋️', accentColor: '#f59e0b',
      summary: '高回弹海绵 · 可拆洗 · 三人位 / 大户型',
      tags: ['舒适','颜值','可拆洗'],
      sales: 2120, rating: 4.7,
      skus: [
        { skuId: 'p008-s1', specText: '三人位 / 米白', salePrice: 3699, stock: 30 },
        { skuId: 'p008-s2', specText: '三人位 / 灰色', salePrice: 3699, stock: 22 },
        { skuId: 'p008-s3', specText: '四人位 / 米白', salePrice: 4699, stock: 12 }
      ],
      published: true
    },
    {
      productId: 'p009', sku: 'ZHX-LAMP-009',
      title: '智能护眼台灯',
      category: 'cat_home',
      material: '金属', style: '现代简约', install: '免安装',
      mainImage: '💡', accentColor: '#facc15',
      summary: '国 AA 级照度 · 无频闪 · 智能感光',
      tags: ['护眼','学生','阅读'],
      sales: 5640, rating: 4.8,
      skus: [
        { skuId: 'p009-s1', specText: '白色 / USB', salePrice: 399, stock: 280 },
        { skuId: 'p009-s2', specText: '白色 / 充电版', salePrice: 499, stock: 120 }
      ],
      published: true
    },
    {
      productId: 'p010', sku: 'ZHX-CUP-010',
      title: '陶瓷餐具套装',
      category: 'cat_home',
      material: '陶瓷', style: '日式', install: '免安装',
      mainImage: '🍱', accentColor: '#fb923c',
      summary: '釉下彩工艺 · 56 件套 · 微波炉可用',
      tags: ['餐具','日式','安全'],
      sales: 1340, rating: 4.6,
      skus: [
        { skuId: 'p010-s1', specText: '青花瓷 / 28件', salePrice: 299, stock: 150 },
        { skuId: 'p010-s2', specText: '和风 / 56件', salePrice: 599, stock: 80 }
      ],
      published: true
    },

    // 美妆个护
    {
      productId: 'p011', sku: 'ZHX-SKIN-011',
      title: '玻尿酸保湿精华',
      category: 'cat_beauty',
      skinType: '所有肤质', volume: '30ml', origin: '法国',
      mainImage: '🧴', accentColor: '#ec4899',
      summary: '5 重玻尿酸 · 24h 长效保湿',
      tags: ['保湿','精华','进口'],
      sales: 9820, rating: 4.9,
      skus: [
        { skuId: 'p011-s1', specText: '30ml / 常规装', salePrice: 299, stock: 350 },
        { skuId: 'p011-s2', specText: '50ml / 大容量', salePrice: 459, stock: 180 }
      ],
      published: true
    },
    {
      productId: 'p012', sku: 'ZHX-MASK-012',
      title: '舒缓修护面膜',
      category: 'cat_beauty',
      skinType: '敏感性', volume: '25ml*5片', origin: '日本',
      mainImage: '🧖', accentColor: '#f43f5e',
      summary: '敏感肌专研 · 24h 强修护',
      tags: ['修护','舒缓','敏感'],
      sales: 4250, rating: 4.7,
      skus: [
        { skuId: 'p012-s1', specText: '5 片装', salePrice: 168, stock: 220 },
        { skuId: 'p012-s2', specText: '10 片装', salePrice: 299, stock: 130 }
      ],
      published: true
    },
    {
      productId: 'p013', sku: 'ZHX-COLOR-013',
      title: '丝绒雾面口红',
      category: 'cat_beauty',
      skinType: '所有肤质', volume: '3.5g', origin: '中国',
      mainImage: '💄', accentColor: '#be185d',
      summary: '持色 12 小时 · 不拔干 · 12 色可选',
      tags: ['口红','持妆','丝绒'],
      sales: 6890, rating: 4.8,
      skus: [
        { skuId: 'p013-s1', specText: '正红色 #001', salePrice: 199, stock: 240 },
        { skuId: 'p013-s2', specText: '枫叶红 #006', salePrice: 199, stock: 180 },
        { skuId: 'p013-s3', specText: '玫瑰豆沙 #012', salePrice: 199, stock: 160 }
      ],
      published: true
    }
  ];

  /* ---------- 智能客服知识库（RAG 检索增强生成的语料）*/
  const KNOWLEDGE_BASE = [
    {
      q: '如何下单', tags: ['订单', '下单', '购买'],
      a: '在商品页点击「加入购物车」，再到购物车点击「去结算」，按提示填写收货地址、选择支付方式即可完成下单。'
    },
    {
      q: '如何查询订单', tags: ['订单', '查询', '物流', '查单'],
      a: '您可以在「我的订单」页面查看所有订单状态；订单详情页可查看物流轨迹。订单状态分为：待支付 / 待发货 / 配送中 / 已完成 / 已取消。'
    },
    {
      q: '支持哪些支付方式', tags: ['支付', '付款'],
      a: '智选云支持微信支付、支付宝、银联云闪付。所有支付均通过加密通道完成，请放心使用。'
    },
    {
      q: '如何申请退款', tags: ['退款', '退货', '售后'],
      a: '在订单详情页点击「申请退款」，选择退款原因并提交。商家会在 24 小时内审核；审核通过后款项将原路退回您的支付账户。'
    },
    {
      q: '如何申请发票', tags: ['发票'],
      a: '下单时可在结算页勾选「需要发票」，填写税号即可；电子发票将在订单完成后 1-3 个工作日开具至您的邮箱。'
    },
    {
      q: '智选云是什么', tags: ['介绍', '平台', '智选云'],
      a: '智选云 AI 电商在线售货系统（AI-ECP）是由 AI 驱动的下一代电商平台，支持「智能客服、智能选品、智能组货」三项 AI 能力，并首创「JSON 自定义品类」机制，新增品类无需发版。'
    },
    {
      q: '什么是 JSON 自定义品类', tags: ['品类', 'JSON', '自定义'],
      a: 'JSON 自定义品类是智选云的特色：商家只需提交一段 JSON 文本，描述品类结构与属性 Schema，系统会自动生成动态发布表单、检索索引、AI 提示词上下文，整个流程无需代码改动。'
    },
    {
      q: '智能选品怎么工作', tags: ['AI', '选品', '推荐'],
      a: '智能选品会基于您的浏览/收藏/加购等行为，进行多路召回（协同过滤 / 语义 / 热门），再经精排打分、业务规则过滤与多样性重排，最终得到「千人千面」的购物推荐。'
    },
    {
      q: '智能组货怎么工作', tags: ['AI', '组货', '搭配'],
      a: '智能组货以「主商品」为中心，识别购物场景并召回配套商品，再对库存/履约/价格/毛利做四维可行性校验，全部通过才输出搭配方案，确保「推荐即能成交」。'
    },
    {
      q: '智能客服是真人吗', tags: ['客服', 'AI', '机器人'],
      a: '智选云的智能客服由 AI 驱动：知识型问题走 RAG 检索增强生成，业务事实型问题（如查订单）走受控工具调用获取真实数据。如置信度不足，会自动转接人工客服。'
    },
    {
      q: '可以修改收货地址吗', tags: ['地址', '修改'],
      a: '订单提交后，若尚未发货，您可在订单详情页点击「修改地址」进行调整；已发货的订单请联系商家协调。'
    },
    {
      q: '运费怎么算', tags: ['运费', '邮费'],
      a: '智选云全场满 99 元包邮；不满 99 元按地区收取 8-15 元运费。新疆/西藏/海外地区运费单独计算。'
    },
    {
      q: '可以取消订单吗', tags: ['取消', '订单'],
      a: '「待支付」状态的订单可直接取消；「待发货」需商家审核；「配送中」及之后不可在线取消。'
    }
  ];

  /* ---------- 联动组货规则（关联规则引擎模拟）*/
  const BUNDLE_RULES = [
    { mainSku: 'p005-s2', items: ['p009-s2', 'p007-s1'], scene: '新家入住·舒适升级', reason: '夏夜清凉、阅读柔和、地面清洁一站配齐' },
    { mainSku: 'p008-s1', items: ['p009-s1', 'p010-s1'], scene: '客厅焕新·北欧风', reason: '沙发/台灯/餐具同风格呼应，整体视觉更和谐' },
    { mainSku: 'p001-s3', items: ['p002-s1', 'p004-s1'], scene: '差旅达人·便携套餐', reason: '降噪耳机隔绝噪音，便携音箱户外听歌，手表监测运动' },
    { mainSku: 'p011-s1', items: ['p012-s1', 'p013-s1'], scene: '日常护肤·三步曲', reason: '精华+面膜+口红组合，保湿修护一步到位' },
    { mainSku: 'p003-s1', items: ['p001-s1', 'p002-s2'], scene: 'Vlog 创作者套装', reason: '口袋相机拍画面，监听耳机听细节，蓝牙音箱播成片' }
  ];

  /* ---------- 默认 demo 用户画像 */
  const DEFAULT_PROFILE = {
    userId: 'u_demo',
    nickname: '演示买家',
    level: '黄金会员',
    preferredCategories: ['cat_digital', 'cat_beauty'],
    priceBand: 'mid',
    behaviorLog: []
  };

  /* ---------- 持久化键名 ---------- */
  const KEYS = {
    products:   'zx.products.v1',
    categories: 'zx.categories.v1',
    cart:       'zx.cart.v1',
    orders:     'zx.orders.v1',
    profile:    'zx.profile.v1',
    messages:   'zx.messages.v1',
    aiLog:      'zx.ai-log.v1'
  };

  /* ---------- 数据加载/保存工具 ---------- */
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return JSON.parse(JSON.stringify(fallback));
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      return JSON.parse(JSON.stringify(fallback));
    }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.warn('save fail', e); }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    const products   = load(KEYS.products,   DEFAULT_PRODUCTS);
    const categories = load(KEYS.categories, DEFAULT_CATEGORIES);
    const cart       = load(KEYS.cart,       []);
    const orders     = load(KEYS.orders,     []);
    const profile    = load(KEYS.profile,    DEFAULT_PROFILE);
    const messages   = load(KEYS.messages,   []);
    save(KEYS.products,   products);
    save(KEYS.categories, categories);
    save(KEYS.cart,       cart);
    save(KEYS.orders,     orders);
    save(KEYS.profile,    profile);
    save(KEYS.messages,   messages);
    return { products, categories, cart, orders, profile, messages };
  }

  /* ---------- 业务方法 ---------- */
  function getAll()        { return init(); }
  function getProducts()   { return load(KEYS.products,   DEFAULT_PRODUCTS); }
  function getCategories() { return load(KEYS.categories, DEFAULT_CATEGORIES); }
  function getCart()       { return load(KEYS.cart,       []); }
  function getOrders()     { return load(KEYS.orders,     []); }
  function getProfile()    { return load(KEYS.profile,    DEFAULT_PROFILE); }
  function getMessages()   { return load(KEYS.messages,   []); }
  function getKnowledge()  { return KNOWLEDGE_BASE.slice(); }
  function getBundleRules(){ return BUNDLE_RULES.slice(); }

  function saveProducts(v)   { save(KEYS.products,   v); }
  function saveCategories(v) { save(KEYS.categories, v); }
  function saveCart(v)       { save(KEYS.cart,       v); }
  function saveOrders(v)     { save(KEYS.orders,     v); }
  function saveProfile(v)    { save(KEYS.profile,    v); }
  function saveMessages(v)   { save(KEYS.messages,   v); }

  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    return init();
  }

  /* ---------- 暴露 ---------- */
  return {
    KEYS, uid, now,
    DEFAULT_PRODUCTS, DEFAULT_CATEGORIES, KNOWLEDGE_BASE, BUNDLE_RULES, DEFAULT_PROFILE,
    init, getAll,
    getProducts, getCategories, getCart, getOrders, getProfile, getMessages,
    getKnowledge, getBundleRules,
    saveProducts, saveCategories, saveCart, saveOrders, saveProfile, saveMessages,
    resetAll
  };
})();