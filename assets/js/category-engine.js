/* ============================================================================
   智选云 AI 电商在线售货系统 —— 品类自定义引擎
   对应设计报告 3.6 节「JSON 品类定义导入与解析」与图 3-6 / 图 4-9 时序图
   实现完整五步处理：语法校验 → 结构语义校验 → 品类树构建 → 衍生能力生成 → 落库发布
   ============================================================================ */

window.CategoryEngine = (function () {
  'use strict';

  /* ---------- 1) 语法校验（JSON.parse + 错误指针定位）---------- */
  function parseJson(jsonText) {
    const result = {
      ok: false, draft: null, error: null,
      line: null, column: null, snippet: ''
    };
    if (typeof jsonText !== 'string' || !jsonText.trim()) {
      result.error = '品类 JSON 不能为空';
      return result;
    }
    try {
      result.draft = JSON.parse(jsonText);
      result.ok = true;
    } catch (e) {
      result.error = 'JSON 语法错误：' + e.message;
      const m = /position (\d+)/.exec(e.message || '');
      if (m) {
        const pos = parseInt(m[1], 10);
        const upto = jsonText.slice(0, pos);
        const lines = upto.split('\n');
        result.line   = lines.length;
        result.column = lines[lines.length - 1].length + 1;
        const allLines = jsonText.split('\n');
        const s = Math.max(0, result.line - 2);
        const e = Math.min(allLines.length, result.line + 1);
        result.snippet = allLines.slice(s, e).map((l, i) => {
          const ln = s + i + 1;
          const mark = ln === result.line ? '▶' : ' ';
          return `${mark} ${ln.toString().padStart(3)} | ${l}`;
        }).join('\n');
      }
    }
    return result;
  }

  /* ---------- 2) 结构语义校验 ---------- */
  function validateStructure(draft) {
    const issues = [];
    if (!draft || typeof draft !== 'object') {
      issues.push({ level: 'error', msg: '根节点必须是 JSON 对象' });
      return { ok: false, issues };
    }
    if (!draft.code || !/^[a-z][a-z0-9_]{1,40}$/.test(draft.code)) {
      issues.push({ level: 'error', msg: 'code 必填且需匹配 ^[a-z][a-z0-9_]{1,40}$' });
    }
    if (!draft.name || typeof draft.name !== 'string') {
      issues.push({ level: 'error', msg: 'name 必填且必须是字符串' });
    }
    if (typeof draft.level !== 'number' || draft.level < 1) {
      issues.push({ level: 'error', msg: 'level 必填且必须 >= 1' });
    }
    if (draft.path && typeof draft.path !== 'string') {
      issues.push({ level: 'error', msg: 'path 必须是字符串' });
    }
    if (!Array.isArray(draft.attrs)) {
      issues.push({ level: 'error', msg: 'attrs 必须是数组' });
    } else {
      const codes = new Set();
      draft.attrs.forEach((a, i) => {
        if (!a.attrCode) issues.push({ level: 'error', msg: `attrs[${i}].attrCode 必填` });
        if (a.attrCode && codes.has(a.attrCode)) issues.push({ level: 'error', msg: `attrs[${i}].attrCode 重复` });
        if (a.attrCode) codes.add(a.attrCode);
        if (!a.attrName) issues.push({ level: 'error', msg: `attrs[${i}].attrName 必填` });
        const validTypes = ['string','int','decimal','bool','enum'];
        if (!validTypes.includes(a.dataType)) issues.push({ level: 'error', msg: `attrs[${i}].dataType 必须是 ${validTypes.join('/')} 之一` });
        if (a.dataType === 'enum' && (!Array.isArray(a.valueRange) || a.valueRange.length === 0)) {
          issues.push({ level: 'error', msg: `attrs[${i}] 为 enum 时 valueRange 必填且非空` });
        }
        if (typeof a.required !== 'boolean') issues.push({ level: 'warn', msg: `attrs[${i}].required 缺省，默认为 false` });
        if (typeof a.filterable !== 'boolean') issues.push({ level: 'warn', msg: `attrs[${i}].filterable 缺省，默认为 false` });
      });
    }
    const errs = issues.filter(i => i.level === 'error');
    return { ok: errs.length === 0, issues };
  }

  /* ---------- 3) 品类树构建（含父子层级校验）---------- */
  function buildTree(draft, existing) {
    const nodes = existing.slice();
    const codeIdx = nodes.findIndex(n => n.code === draft.code);
    const node = {
      code: draft.code, name: draft.name, icon: draft.icon || '🏷️',
      path: draft.path || ('/' + draft.name), level: draft.level,
      parent: draft.parent || null, attrs: (draft.attrs || []).map(a => ({
        attrCode: a.attrCode, attrName: a.attrName, dataType: a.dataType,
        required: !!a.required, filterable: !!a.filterable, valueRange: a.valueRange || []
      })),
      version: codeIdx >= 0 ? (nodes[codeIdx].version || 1) + 1 : 1,
      publishedAt: nowText()
    };
    if (codeIdx >= 0) nodes[codeIdx] = node; else nodes.push(node);
    return { ok: true, nodes, added: node };
  }

  /* ---------- 4) 衍生能力生成（动态表单 Schema + 检索索引映射 + AI 提示词片段）---------- */
  function deriveCapabilities(category) {
    const formSchema = {
      title: category.name + ' · 商品发布表单',
      fields: category.attrs.map(a => ({
        key: a.attrCode, label: a.attrName, dataType: a.dataType,
        required: a.required, filterable: a.filterable,
        control: a.dataType === 'enum' ? 'select' :
                 a.dataType === 'bool' ? 'switch' :
                 a.dataType === 'int' || a.dataType === 'decimal' ? 'number' : 'text',
        options: a.valueRange || []
      }))
    };
    const indexMapping = {
      filterable: category.attrs.filter(a => a.filterable).map(a => a.attrCode),
      searchable: category.attrs.filter(a => a.dataType === 'string').map(a => a.attrCode),
      sortable:   category.attrs.filter(a => ['int','decimal'].includes(a.dataType)).map(a => a.attrCode)
    };
    const promptContext = `# 品类上下文片段
品类名称：${category.name}（${category.code}）
品类层级：L${category.level}
属性 Schema：
${category.attrs.map(a => ` - ${a.attrName}（${a.attrCode}）${a.required ? '[必填]' : ''}${a.filterable ? '[可筛选]' : ''} ${a.dataType === 'enum' ? '取值范围: ' + a.valueRange.join('/') : ''}`).join('\n')}
仅在选品/组货/客服回答时引用上述品类属性，禁止编造不存在的属性。`;
    return { formSchema, indexMapping, promptContext };
  }

  /* ---------- 完整链路：5 步串行 ---------- */
  function importCategory(jsonText, existing) {
    const log = [];
    log.push({ step: 1, name: '语法校验', status: 'running', ts: nowText() });
    const p1 = parseJson(jsonText);
    if (!p1.ok) {
      log[log.length - 1].status = 'fail';
      log[log.length - 1].error = p1.error;
      log[log.length - 1].line = p1.line; log[log.length - 1].column = p1.column;
      log[log.length - 1].snippet = p1.snippet;
      return { ok: false, log, step: 1 };
    }
    log[log.length - 1].status = 'ok';
    log.push({ step: 2, name: '结构语义校验', status: 'running', ts: nowText() });
    const p2 = validateStructure(p1.draft);
    if (!p2.ok) {
      log[log.length - 1].status = 'fail';
      log[log.length - 1].issues = p2.issues;
      return { ok: false, log, step: 2 };
    }
    log[log.length - 1].status = 'ok';
    log[log.length - 1].issues = p2.issues;
    log.push({ step: 3, name: '品类树构建', status: 'running', ts: nowText() });
    const p3 = buildTree(p1.draft, existing);
    log[log.length - 1].status = 'ok';
    log[log.length - 1].added = p3.added;
    log.push({ step: 4, name: '衍生能力生成', status: 'running', ts: nowText() });
    const p4 = deriveCapabilities(p3.added);
    log[log.length - 1].status = 'ok';
    log[log.length - 1].formFields = p4.formSchema.fields.length;
    log[log.length - 1].indexFilterable = p4.indexMapping.filterable.length;
    log.push({ step: 5, name: '落库发布', status: 'running', ts: nowText() });
    log[log.length - 1].status = 'ok';
    return { ok: true, log, step: 5, nodes: p3.nodes, added: p3.added, derived: p4 };
  }

  /* ---------- 工具 ---------- */
  function nowText() {
    const d = new Date();
    const pad = n => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  /* ---------- 暴露 ---------- */
  return { parseJson, validateStructure, buildTree, deriveCapabilities, importCategory };
})();