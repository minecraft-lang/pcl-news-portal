/* PCL CE 自定义主页官网 — 交互脚本（原生 JS 实现，不引入任何第三方库） */
(function () {
  'use strict';

  var KEY = 'pclnh-theme';
  var root = document.documentElement;

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('title', t === 'dark' ? '切换到亮色主题' : '切换到暗色主题');
      btns[i].setAttribute('aria-label', t === 'dark' ? '切换到亮色主题' : '切换到暗色主题');
    }
  }

  // 主题切换按钮
  var toggles = document.querySelectorAll('[data-theme-toggle]');
  for (var i = 0; i < toggles.length; i++) {
    toggles[i].addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  }
  // 初始化按钮文案
  setTheme(currentTheme());

  // 代码块复制
  var blocks = document.querySelectorAll('.code');
  for (var j = 0; j < blocks.length; j++) {
    (function (box) {
      var btn = box.querySelector('.copy-btn');
      var pre = box.querySelector('pre');
      if (!btn || !pre) return;
      btn.addEventListener('click', function () {
        var text = pre.innerText;
        var done = function () {
          btn.textContent = '已复制';
          setTimeout(function () { btn.textContent = '复制'; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
        } else {
          fallback(text, done);
        }
      });
    })(blocks[j]);
  }

  function fallback(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ---------------- 滚动高亮：首页顶部导航 + 文档页侧栏 ----------------
  // 锚点滚动偏移与 CSS 的 html{scroll-padding-top:84px} 保持一致（多留 4px 缓冲，避免取整判错）
  var NAV_OFFSET = 88;

  var pageName = (function () {
    var p = (location.pathname || '').split('/').pop();
    return p || 'index.html';
  })();

  function scrollTopNow() {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function absTop(el) {
    return el.getBoundingClientRect().top + scrollTopNow();
  }

  // 只收集"指向本页"的链接：跨页链接（如 index.html -> docs.html）不参与滚动高亮
  function collectItems(linkEls) {
    var items = [];
    for (var i = 0; i < linkEls.length; i++) {
      var a = linkEls[i];
      var href = a.getAttribute('href') || '';
      var at = href.indexOf('#');
      var file = at < 0 ? href : href.slice(0, at);
      var hash = at < 0 ? '' : href.slice(at + 1);
      if (file && file !== pageName) continue;
      if (!hash) { items.push({ link: a, el: null }); continue; }
      var el = document.getElementById(hash);
      if (el) items.push({ link: a, el: el, hash: hash });
    }
    return items;
  }

  function setupSpy(items, offset) {
    if (!items.length) return;
    var lock = null;
    var ticking = false;

    function paint(active) {
      for (var i = 0; i < items.length; i++) {
        var on = items[i] === active;
        items[i].link.classList.toggle('active', on);
        if (on) { items[i].link.setAttribute('aria-current', 'true'); }
        else { items[i].link.removeAttribute('aria-current'); }
      }
    }

    function pick() {
      var y = scrollTopNow();
      // +12px 缓冲：点击定位后标题正好落在偏移线上，避免浮点误差把当前项判给上一项
      var pos = y + offset + 12;
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      var chosen = items[0];
      for (var i = 0; i < items.length; i++) {
        var t = items[i].el ? absTop(items[i].el) : 0;
        if (t <= pos) chosen = items[i];
      }
      // 滚到底部时，末尾锚点（如"卸载与回退"）无法顶到视口顶部，强制高亮最后一项
      if (maxScroll > 0 && y >= maxScroll - 4) {
        for (var k = items.length - 1; k >= 0; k--) {
          if (items[k].el) { chosen = items[k]; break; }
        }
      }
      return chosen;
    }

    function update() {
      ticking = false;
      if (lock) {
        var arrived = Math.abs(scrollTopNow() - lock.top) < 6;
        if (Date.now() < lock.until && !arrived) { paint(lock.item); return; }
        lock = null;
      }
      paint(pick());
    }

    function request() {
      if (ticking) return;
      ticking = true;
      if (window.requestAnimationFrame) { window.requestAnimationFrame(update); }
      else { setTimeout(update, 16); }
    }

    function reduceMotion() {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    // 就地把某个锚点对齐到视口顶部（偏移量与 scroll-padding 一致），并同步高亮
    function goTo(item, smooth) {
      var target = item && item.el ? Math.max(0, absTop(item.el) - NAV_OFFSET) : 0;
      lock = { item: item, hash: item && item.hash ? item.hash : '', top: target, until: Date.now() + 1200 };
      paint(item);
      window.scrollTo({ top: target, behavior: (smooth && !reduceMotion()) ? 'smooth' : 'auto' });
      request();
    }

    // 用地址栏 hash（含直接带 #x 打开）校正位置与高亮
    function syncHash(smooth) {
      var h = (location.hash || '').replace('#', '');
      if (!h) return false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].hash === h && items[i].el) { goTo(items[i], smooth); return true; }
      }
      return false;
    }

    for (var i = 0; i < items.length; i++) {
      (function (item) {
        item.link.addEventListener('click', function (ev) {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button > 0) return;
          // 本页链接全部自行滚动：点击瞬间即高亮，滚动过程中保持，避免高亮来回跳
          ev.preventDefault();
          goTo(item, true);
          var newHash = item.el && item.hash ? '#' + item.hash : '';
          if (window.history && history.pushState) {
            try { history.pushState(null, '', location.pathname + location.search + newHash); }
            catch (e) { if (newHash) { location.hash = newHash; } }
          }
        });
      })(items[i]);
    }

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (lock && lock.hash === h) { paint(lock.item); return; }
      lock = null;
      if (!syncHash(false)) { update(); }
    });
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', function () { lock = null; request(); }, { passive: true });
    }
    window.addEventListener('load', function () { lock = null; if (!syncHash(false)) { update(); } });

    // 初始进入：若地址带 hash，自己对齐一次（比浏览器原生定位更可控）
    if (!syncHash(false)) { update(); }
  }

  // 首页：顶部导航（首页 / 特性 / 原理 / 下载）
  var navLinks = document.querySelectorAll('.nav-links a');
  if (navLinks.length) {
    setupSpy(collectItems(navLinks), NAV_OFFSET);
  }

  // 文档页：左侧分组导航
  var sideLinks = document.querySelectorAll('.sidebar a[href^="#"]');
  if (sideLinks.length) {
    setupSpy(collectItems(sideLinks), NAV_OFFSET);
  }
})();
