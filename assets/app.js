/* ==========================================================================
   智选云 AI 电商在线售货系统 —— 站点交互脚本
   · UML 图集筛选
   · 图片查看器（缩放 / 拖动 / 触屏捏合 / 下载 / 键盘）
   · 报告目录高亮
   ========================================================================== */
(function () {
  'use strict';

  /* -------------------------------------------------- 图集筛选 */
  function initFilters() {
    var grid = document.getElementById('dgrid');
    var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
    if (!grid || !chips.length) return;
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var f = chip.getAttribute('data-filter');
        Array.prototype.slice.call(grid.querySelectorAll('.dcard')).forEach(function (card) {
          var show = (f === 'all' || card.getAttribute('data-group') === f);
          card.style.display = show ? '' : 'none';
        });
      });
    });
    // 支持 diagrams.html#g-需求分析 直达
    var h = decodeURIComponent(location.hash || '');
    if (h.indexOf('#g-') === 0) {
      var target = chips.filter(function (c) { return c.getAttribute('data-filter') === h.slice(3); })[0];
      if (target) target.click();
    }
  }

  /* -------------------------------------------------- 图片查看器 */
  var viewer, stage, img, titleEl, dlEl;
  var scale = 1, tx = 0, ty = 0, natural = { w: 0, h: 0 };
  var dragging = false, lastX = 0, lastY = 0;
  var pinch = null;

  function apply() {
    img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
  }

  function fit() {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (!natural.w || !natural.h) return;
    var s = Math.min(sw / natural.w, sh / natural.h) * 0.96;
    s = Math.min(s, 4);
    scale = s;
    tx = (sw - natural.w * s) / 2;
    ty = (sh - natural.h * s) / 2;
    apply();
  }

  function zoomAt(px, py, factor) {
    var ns = Math.max(0.05, Math.min(12, scale * factor));
    tx = px - (px - tx) * (ns / scale);
    ty = py - (py - ty) * (ns / scale);
    scale = ns;
    apply();
  }

  function zoomCenter(factor) {
    zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, factor);
  }

  function open(src, title) {
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    titleEl.textContent = title || '';
    dlEl.setAttribute('href', src);
    img.onload = function () {
      natural.w = img.naturalWidth || 1200;
      natural.h = img.naturalHeight || 800;
      fit();
    };
    img.src = src;
    if (img.complete && img.naturalWidth) {
      natural.w = img.naturalWidth;
      natural.h = img.naturalHeight;
      fit();
    }
  }

  function close() {
    viewer.hidden = true;
    document.body.style.overflow = '';
    img.removeAttribute('src');
  }

  function initViewer() {
    viewer = document.getElementById('viewer');
    if (!viewer) return;
    stage = document.getElementById('viewerStage');
    img = document.getElementById('viewerImg');
    titleEl = document.getElementById('viewerTitle');
    dlEl = document.getElementById('viewerDownload');

    viewer.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'close') close();
      if (act === 'zoomin') zoomCenter(1.28);
      if (act === 'zoomout') zoomCenter(1 / 1.28);
      if (act === 'fit') fit();
      if (act === 'one') { zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1 / scale); }
    });

    // 滚轮缩放
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = stage.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    // 拖动平移 + 双指捏合
    stage.addEventListener('pointerdown', function (e) {
      stage.setPointerCapture(e.pointerId);
      if (pinch === null) {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        stage.classList.add('grabbing');
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      tx += e.clientX - lastX;
      ty += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      apply();
    });
    function endDrag(e) {
      dragging = false;
      stage.classList.remove('grabbing');
      try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', function () { dragging = false; stage.classList.remove('grabbing'); });

    // 双击放大 / 复位
    stage.addEventListener('dblclick', function (e) {
      var r = stage.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, 1.6);
    });

    // 触屏捏合
    var pts = {};
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        dragging = false;
        pts = {};
        Array.prototype.forEach.call(e.touches, function (t) { pts[t.identifier] = t; });
        var k = Object.keys(pts);
        pinch = {
          d: Math.hypot(pts[k[0]].clientX - pts[k[1]].clientX, pts[k[0]].clientY - pts[k[1]].clientY),
          s: scale
        };
      }
    }, { passive: true });
    stage.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        var r = stage.getBoundingClientRect();
        var a = e.touches[0], b = e.touches[1];
        var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        var cx = (a.clientX + b.clientX) / 2 - r.left;
        var cy = (a.clientY + b.clientY) / 2 - r.top;
        var target = Math.max(0.05, Math.min(12, pinch.s * (d / pinch.d)));
        zoomAt(cx, cy, target / scale);
      }
    }, { passive: false });
    stage.addEventListener('touchend', function (e) {
      if (e.touches.length < 2) pinch = null;
    });

    // 键盘
    document.addEventListener('keydown', function (e) {
      if (viewer.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === '+' || e.key === '=') zoomCenter(1.2);
      else if (e.key === '-' || e.key === '_') zoomCenter(1 / 1.2);
      else if (e.key === '0') fit();
      else if (e.key === '1') zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1 / scale);
    });

    window.addEventListener('resize', function () {
      if (!viewer.hidden) fit();
    });

    // 图集卡片
    Array.prototype.forEach.call(document.querySelectorAll('.dcard'), function (card) {
      var thumb = card.querySelector('.dcard-thumb');
      var label = (card.getAttribute('data-title') || '') + '　' + (card.querySelector('h3') ? card.querySelector('h3').textContent : '');
      function go() { open(card.getAttribute('data-src'), label.trim()); }
      if (thumb) { thumb.addEventListener('click', go); }
      var cap = card.querySelector('h3');
      if (cap) { cap.style.cursor = 'zoom-in'; cap.addEventListener('click', go); }
    });

    // 报告正文插图
    Array.prototype.forEach.call(document.querySelectorAll('.doc img'), function (el) {
      el.addEventListener('click', function () {
        var alt = el.getAttribute('alt') || 'UML 图';
        open(el.getAttribute('src'), alt);
      });
    });
  }

  /* -------------------------------------------------- 报告目录高亮 */
  function initToc() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc-list a'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) {
      var id = decodeURIComponent(a.getAttribute('href').slice(1));
      map[id] = a;
    });
    var heads = Array.prototype.slice.call(document.querySelectorAll('.doc h2[id], .doc h3[id]'));
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.style.background = ''; a.style.color = ''; a.style.borderLeftColor = ''; });
          var a = map[en.target.id];
          if (a) { a.style.background = '#eef3f8'; a.style.color = '#1f4e79'; a.style.borderLeftColor = '#4a90d9'; }
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
    heads.forEach(function (h) { obs.observe(h); });
  }

  /* -------------------------------------------------- 移动端导航自动收起 */
  function initNav() {
    var toggle = document.getElementById('navToggle');
    if (!toggle) return;
    Array.prototype.forEach.call(document.querySelectorAll('.mainnav a'), function (a) {
      a.addEventListener('click', function () { toggle.checked = false; });
    });
  }

  function init() {
    initNav();
    initFilters();
    initViewer();
    initToc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
