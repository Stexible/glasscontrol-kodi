/* Glass Control — каркас: тема, навигация, роутер (с кэшем страниц), индикатор сканирования, запуск */
(function () {
  'use strict';
  var K = window.K, t = K.t, html = K.html, ic = K.ic, $ = K.$;
  var NAV = [
    ['/', 'home', 'Главная'], ['/now', 'play', 'Сейчас играет'], 0,
    ['/movies', 'film', 'Фильмы'], ['/tv', 'tv', 'Сериалы'], ['/music', 'music', 'Музыка'], ['/mv', 'clip', 'Клипы'], 0,
    ['/files', 'folder', 'Файлы'], ['/fav', 'star', 'Избранное'], ['/queue', 'list', 'Очередь'], ['/pvr', 'radio', 'ТВ и радио'], 0,
    ['/addons', 'box', 'Дополнения'], ['/settings', 'sliders', 'Настройки'], ['/remote', 'remote', 'Пульт'], ['/system', 'monitor', 'Система']
  ];
  var TABS = [['/', 'home', 'Главная'], ['/now', 'play', 'Играет'], ['/movies', 'film', 'Медиатека'], ['/remote', 'remote', 'Пульт'], 'menu'];

  /* ---------- тема и акцент ---------- */
  K.ACCENTS = [
    { id: 'teal', ac: [84, 214, 226], a: [48, 160, 182], b: [34, 96, 128], top: '#071522', bot: '#030a11', ltop: '#e6f3f8', lbot: '#cfe3ec' },
    { id: 'blue', ac: [110, 165, 255], a: [56, 110, 230], b: [34, 70, 160], top: '#08122b', bot: '#03060f', ltop: '#e7eefc', lbot: '#cfdcf3' },
    { id: 'violet', ac: [180, 150, 255], a: [120, 84, 210], b: [78, 52, 150], top: '#130d26', bot: '#07040f', ltop: '#efe9fb', lbot: '#dcd0f2' },
    { id: 'rose', ac: [255, 128, 165], a: [200, 64, 108], b: [138, 42, 86], top: '#1d0a14', bot: '#0b0409', ltop: '#fbe9ef', lbot: '#f1d0db' },
    { id: 'amber', ac: [255, 194, 96], a: [200, 126, 40], b: [140, 84, 28], top: '#1c1308', bot: '#0b0804', ltop: '#fbf0de', lbot: '#efdcbd' },
    { id: 'green', ac: [112, 228, 164], a: [40, 164, 112], b: [28, 112, 82], top: '#07190f', bot: '#030b07', ltop: '#e4f5ec', lbot: '#c9e6d6' }
  ];
  function mix(c, k, to) { return c.map(function (v) { return Math.round(v + (to - v) * k); }); }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  K.theme = {
    get mode() { return K.store.get('theme', 'dark'); }, get accent() { return K.store.get('accent', 'teal'); },
    apply: function () {
      var mode = K.theme.mode, light = mode === 'light' || (mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
      var A = K.ACCENTS.filter(function (x) { return x.id === K.theme.accent; })[0] || K.ACCENTS[0], r = document.documentElement.style;
      document.documentElement.dataset.theme = light ? 'light' : 'dark';
      r.setProperty('--ac', A.ac.join(',')); r.setProperty('--ac-l', hex(mix(A.ac, .1, 255))); r.setProperty('--ac-l2', hex(mix(A.ac, .35, 255)));
      r.setProperty('--ac-d2', hex(mix(A.ac, .45, 0))); r.setProperty('--ac-d3', hex(mix(A.ac, .2, 0))); r.setProperty('--accent-d', hex(mix(A.ac, .35, 0)));
      r.setProperty('--ac-ink', mix(A.ac, .5, 0).join(','));
      r.setProperty('--bg-a', A.a.join(',')); r.setProperty('--bg-b', A.b.join(','));
      r.setProperty('--bg-top', light ? A.ltop : A.top); r.setProperty('--bg-bot', light ? A.lbot : A.bot);
      var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = light ? A.ltop : A.top;
    },
    set: function (k, v) { K.store.set(k, v); K.theme.apply(); }
  };
  K.theme.apply();
  if (window.matchMedia) try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (K.theme.mode === 'auto') K.theme.apply(); }); } catch (e) { /* старый браузер */ }

  /* ---------- навигация ---------- */
  function seg(path) { return '/' + (path.split('/')[1] || ''); }
  function drawNav() {
    var cur = seg(K.cur.path), pl = K.player && K.player.id != null, hidePvr = K.st.nopvr;
    var hidden = K.store.get('hiddenNav', null);
    if (hidden === null) hidden = hidePvr ? ['/pvr'] : [];
    hidden = hidden || [];
    var n = NAV.filter(function (x) { return x === 0 || (x && hidden.indexOf(x[0]) < 0); });
    K.mount($('#nav'), html`<div class="brand"><div class="brand-logo">${ic('play', 20)}</div><div><b>Glass Control</b><small>Kodi</small></div></div>
      ${n.map(function (x) { return x ? html`<a class="nv ${x[0] === cur ? 'on' : ''}" href="#${x[0]}">${ic(x[1], 20)}<span>${t(x[2])}</span>${x[0] === '/now' && pl ? html`<i class="dot"></i>` : ''}</a>` : html`<hr class="sep">`; })}
      <div class="side-foot"><div class="seg">${['ru', 'en'].map(function (l) { return html`<button class="${K.lang === l ? 'on' : ''}" data-act="lang" data-v="${l}">${l.toUpperCase()}</button>`; })}</div><span id="ver">${K.st.verText || ''}</span></div>`, 'nav|' + cur + '|' + !!pl + '|' + !!hidePvr + '|' + K.lang + '|' + (K.st.verText || '') + '|' + hidden.join(','));
    K.mount($('#tabbar'), html`${TABS.filter(function (x) { return x === 'menu' || hidden.indexOf(x[0]) < 0; }).map(function (x) {
      if (x === 'menu') return html`<button data-act="drawer">${ic('menu', 22)}<span>${t('Меню')}</span></button>`;
      var on = x[0] === cur || (x[0] === '/movies' && ['/tv', '/music', '/mv'].indexOf(cur) >= 0);
      return html`<a class="${on ? 'on' : ''}" href="#${x[0]}">${ic(x[1], 22)}<span>${t(x[2])}</span></a>`; })}`, 'tab|' + cur);
  }
  K.NAV = NAV;
  K.drawNav = drawNav;
  K.acts.drawer = function () { document.body.classList.toggle('drawer'); };
  K.acts.lang = function (el) { K.setLang(el.dataset.v); };

  /* ---------- роутер с кэшем списков ---------- */
  K.cur = { path: '/', q: {} };
  var active = null, token = 0, CACHE = {}, ORDER = [];
  function parse() {
    var h = location.hash.replace(/^#/, '') || '/', i = h.indexOf('?'), path = i < 0 ? h : h.slice(0, i), q = {};
    if (i >= 0) h.slice(i + 1).split('&').forEach(function (p) { if (!p) return; var kv = p.split('='); q[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')); });
    path = '/' + path.split('/').filter(Boolean).map(decodeURIComponent).join('/');
    return { path: path, q: q, seg: path.split('/').filter(Boolean), key: h };
  }
  function runCleanup(ctx) { (ctx.cleanup || []).forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); ctx.cleanup = []; }
  function stash(ctx, view) {
    var frag = document.createDocumentFragment();
    while (view.firstChild) frag.appendChild(view.firstChild);
    CACHE[ctx.key] = { ctx: ctx, frag: frag, y: window.scrollY, dirty: false };
    ORDER = ORDER.filter(function (k) { return k !== ctx.key; }); ORDER.push(ctx.key);
    while (ORDER.length > 8) { var old = ORDER.shift(); if (CACHE[old]) { runCleanup(CACHE[old].ctx); delete CACHE[old]; } }
  }
  function dropCache(key) { var c = CACHE[key]; if (c) { runCleanup(c.ctx); delete CACHE[key]; ORDER = ORDER.filter(function (k) { return k !== key; }); } }
  K.dropCache = dropCache;
  K.go = function (p) { if (location.hash === '#' + p) K.route(true); else location.hash = p; };
  K.route = function (force) {
    var r = parse(), name = r.seg[0] || 'home', page = K.pages[name], view = $('#view'), my = ++token;
    /* уходим со страницы: либо кладём в кэш, либо чистим */
    if (active) {
      if (active.cacheable && active.key !== r.key && active.ok) stash(active, view); else runCleanup(active);
      if (active.cacheable && active.key === r.key && force) { /* перезагрузка той же страницы */ }
    }
    active = null;
    document.body.classList.remove('drawer');
    document.body.classList.toggle('nowpage', name === 'now');
    document.body.classList.toggle('remotepage', name === 'remote');
    K.cur = r; drawNav();
    if (force) dropCache(r.key);
    var hit = CACHE[r.key];
    if (hit && page) {
      view.textContent = ''; view.appendChild(hit.frag); active = hit.ctx; active.alive = function () { return my === token; };
      delete CACHE[r.key]; ORDER = ORDER.filter(function (k) { return k !== r.key; });
      document.title = (page.title ? page.title(r) + ' · ' : '') + 'Glass Control';
      if (hit.dirty && active.refresh) {
        active.refresh().then(function () { window.scrollTo(0, hit.y); });
      } else {
        window.scrollTo(0, hit.y);
      }
      return;
    }
    window.scrollTo(0, 0);
    if (!page) { K.mount(view, K.ui.empty('info', t('Страница не найдена'))); return; }
    document.title = (page.title ? page.title(r) + ' · ' : '') + 'Glass Control';
    view.innerHTML = K.frag(K.ui.loading());
    view._sig = undefined;
    var ctx = { view: view, args: r.seg.slice(1), q: r.q, path: r.path, key: r.key, cleanup: [], ok: false, cacheable: !!(page.cache && page.cache(r)), alive: function () { return my === token; } };
    active = ctx;
    var fin = function () { ctx.ok = true; };
    try {
      var res = page.render(ctx);
      if (res && res.then) res.then(fin, function (e) { if (my === token) { console.error(e); K.mount(view, K.ui.error(e, true)); } });
      else fin();
    } catch (e) { console.error(e); K.mount(view, K.ui.error(e, true)); }
  };
  window.addEventListener('hashchange', function () { K.route(); });
  /* изменение медиатеки: активная страница обновляется мягко, кэшированные помечаются устаревшими */
  K.on('library', function () {
    Object.keys(CACHE).forEach(function (k) { CACHE[k].dirty = true; });
    if (active && active.refresh) active.refresh(); else if (active && active.reloadOnLibrary) K.route(true);
  });

  /* ---------- индикатор сканирования/очистки ---------- */
  var S = K.scan = { video: false, music: false, label: '', base: null, timer: null, cnt: null, job: '' };
  function counts() {
    return K.batch([['VideoLibrary.GetMovies', { properties: ['title'], limits: { start: 0, end: 1 } }], ['VideoLibrary.GetEpisodes', { properties: ['title'], limits: { start: 0, end: 1 } }],
      ['AudioLibrary.GetSongs', { properties: ['title'], limits: { start: 0, end: 1 } }]]).then(function (r) {
      function tot(x) { return K.ok(x) && x.limits ? x.limits.total : 0; }
      return { v: tot(r[0]) + tot(r[1]), m: tot(r[2]) };
    });
  }
  function paint() {
    var on = S.video || S.music, el = $('#scan');
    document.body.classList.toggle('scanning', on);
    if (!el) return;
    var what = (S.video && S.music) ? t('видео и музыки') : S.video ? t('видео') : t('музыки');
    var d = '';
    if (S.cnt && S.base) { var dv = S.cnt.v - S.base.v, dm = S.cnt.m - S.base.m, n = (S.video ? dv : 0) + (S.music ? dm : 0); if (n) d = ' · ' + (n > 0 ? '+' : '') + n; }
    el.querySelector('span').textContent = (S.job === 'clean' ? t('Очистка') : t('Сканирование')) + ' ' + what + d;
  }
  function poll() {
    clearTimeout(S.timer);
    K.rpc('XBMC.GetInfoBooleans', { booleans: ['Library.IsScanningVideo', 'Library.IsScanningMusic'] }).then(function (b) {
      var was = S.video || S.music; S.video = !!b['Library.IsScanningVideo']; S.music = !!b['Library.IsScanningMusic'];
      var on = S.video || S.music;
      if (on && !was) { S.base = null; counts().then(function (c) { S.base = c; S.cnt = c; }); }
      if (on) {
        counts().then(function (c) { if (S.cnt && (c.v !== S.cnt.v || c.m !== S.cnt.m)) K.emit('library:soft'); S.cnt = c; paint(); });
        S.timer = setTimeout(poll, 2500);
      } else if (was) { K.emit('library'); S.job = ''; }
      paint();
    }).catch(function () { S.timer = setTimeout(poll, 5000); });
  }
  /* мягкое обновление списков по ходу сканирования (не чаще раза в 4 с) */
  var softT = 0;
  K.on('library:soft', function () { if (Date.now() - softT < 4000) return; softT = Date.now(); if (active && active.refresh) active.refresh(); });
  K.scan.watch = function (job) { S.job = job || 'scan'; poll(); };
  ['VideoLibrary', 'AudioLibrary'].forEach(function (l) { K.on('n:' + l + '.OnScanStarted', function () { S.job = 'scan'; poll(); }); K.on('n:' + l + '.OnCleanStarted', function () { S.job = 'clean'; poll(); }); });
  function idle(kind) {
    return new Promise(function (res) {
      (function tick(n) {
        K.rpc('XBMC.GetInfoBooleans', { booleans: [kind === 'video' ? 'Library.IsScanningVideo' : 'Library.IsScanningMusic'] }).then(function (b) {
          var on = !!b[kind === 'video' ? 'Library.IsScanningVideo' : 'Library.IsScanningMusic'];
          if (on && n < 1200) setTimeout(function () { tick(n + 1); }, 1500); else res();
        }).catch(res);
      })(0);
    });
  }
  /* Быстрое обновление: сканирование находит только новые/изменённые файлы (ничего не пересоздаётся), затем чистка убирает записи о пропавших */
  function libUpdate0(kind, o) {
    o = o || {}; var V = kind === 'video', lib = V ? 'VideoLibrary.' : 'AudioLibrary.', sp = { showdialogs: false };
    if (o.directory) sp.directory = o.directory;
    S.job = 'scan';
    return K.rpc(lib + 'Scan', sp).then(function () { K.toast(t('Сканирование запущено'), 'ok'); setTimeout(poll, 600); return o.clean === false ? null : new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return idle(kind); }); })
      .then(function () { if (o.clean === false) return; S.job = 'clean'; var cp = { showdialogs: false }; if (V && o.content) cp.content = o.content; return K.rpc(lib + 'Clean', cp).then(function () { setTimeout(poll, 600); return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return idle(kind); }); }); })
      .then(function () { if (o.clean !== false) K.toast(t('Обновление медиатеки завершено'), 'ok'); K.emit('library'); }).catch(K.err);
  }
  /* перед обновлением чиним источники и базу: без этого Kodi не видит новые папки и не рекурсирует в подпапки */
  K.libUpdate = function (kind, o) {
    K._libInflight = K._libInflight || {};
    if (K._libInflight[kind]) return K._libInflight[kind];
    var p = K.be.init().then(function () {
      if (!K.be.ok) return null;
      return K.be.call('/api/lib/fix', { kind: kind }).catch(function () { return null; });
    }).then(function () { return libUpdate0(kind, o); });
    K._libInflight[kind] = p;
    p.finally(function () { delete K._libInflight[kind]; });
    return p;
  };
  /* после добавления источника с новым паролем профиль перезагружается: дожидаемся Kodi и запускаем отложенное сканирование */
  var pendingBusy = false;
  K.runPendingScan = function () {
    if (pendingBusy) return;
    var s = null;
    try { s = JSON.parse(localStorage.getItem('gc.pendingScan') || 'null'); } catch (e) { }
    if (!s || !s.kind || !s.path) return;
    pendingBusy = true;
    var n = 0;
    (function tick() {
      setTimeout(function () {
        K.rpc('JSONRPC.Ping').then(function () {
          try { localStorage.removeItem('gc.pendingScan'); } catch (e) { }
          pendingBusy = false;
          K.toast(t('Сканирование добавленного источника'), 'ok');
          // после перезагрузки профиля у службы новый токен: обновляем подключение к серверной части
          var ready = (K.be && K.be.retry) ? K.be.retry().catch(function () { return false; }) : Promise.resolve(false);
          ready.then(function () { K.libUpdate(s.kind, { directory: s.path, clean: false }); });
        }, function () {
          if (++n < 80) tick(); else pendingBusy = false;
        });
      }, n === 0 ? 3000 : 1500);
    })();
  };
  K.libClean = function (kind, content) {
    var V = kind === 'video', p = { showdialogs: false }; if (V && content) p.content = content;
    S.job = 'clean';
    return K.rpc((V ? 'VideoLibrary.' : 'AudioLibrary.') + 'Clean', p).then(function () { K.toast(t('Очистка запущена'), 'ok'); setTimeout(poll, 600); }).catch(K.err);
  };
  K.libScanOnly0 = function (kind, dir) { var p = { showdialogs: false }; if (dir) p.directory = dir; S.job = 'scan'; return K.rpc((kind === 'video' ? 'VideoLibrary.' : 'AudioLibrary.') + 'Scan', p).then(function () { K.toast(t('Сканирование запущено'), 'ok'); setTimeout(poll, 600); }).catch(K.err); };
  K.libScanOnly = function (kind, dir) { return K.libUpdate(kind, { directory: dir, clean: false }); };
  K.acts.quick = function (el) { var k = el.dataset.v; return k === 'all' ? Promise.all([K.libUpdate('video'), K.libUpdate('music')]) : K.libUpdate(k, { content: el.dataset.c }); };
  /* «Очистить» = полный сброс базы медиатеки (видео или музыки) с нуля; «Обновить» уже сам добавляет новое и убирает удалённое */
  K.libWipe = function (kind) {
    var name = kind === 'video' ? t('видео') : t('музыки');
    return K.be.init().then(function () {
      if (!K.be.ok) return K.toast(t('Для полной очистки медиатеки нужен Glass Control Backend'), 'err');
      return K.rpc('XBMC.GetInfoBooleans', { booleans: ['Library.IsScanningVideo', 'Library.IsScanningMusic'] }).then(function (b) {
        if (b['Library.IsScanningVideo'] || b['Library.IsScanningMusic']) return K.toast(t('Дождитесь окончания сканирования'), 'err');
        return K.ui.confirm(t('Полностью очистить медиатеку {n}? Будут стёрты все записи, отметки просмотра, точки возобновления и оценки. Файлы не удаляются; тип содержимого источников (фильмы/сериалы) сохраняется. Копия базы сохранится рядом (*.glassbak). После этого нажмите «Обновить», чтобы собрать медиатеку заново.', { n: name }), { danger: true, ok: t('Очистить медиатеку') }).then(function (y) {
          if (!y) return;
          return K.be.call('/api/lib/wipe', { kind: kind }).then(function () {
            K.toast(t('Медиатека очищена'), 'ok'); K.emit('library');
            return K.ui.confirm(t('Чтобы Kodi увидел пустую базу, перезагрузите профиль (или перезапустите Kodi).'), { ok: t('Перезагрузить профиль'), cancel: t('Позже') }).then(function (r) {
              if (!r) return;
              return K.rpc('Profiles.GetCurrentProfile', {}).then(function (p) { return K.rpc('Profiles.LoadProfile', { profile: p.label, prompt: false }); }).then(function () { K.toast(t('Профиль перезагружается…'), 'ok'); });
            });
          });
        });
      });
    }).catch(K.err);
  };
  K.acts.lclean = function (el) { return K.libWipe(el.dataset.v); };

  /* ---------- поиск, верхняя панель ---------- */
  function initTop() {
    $('.menu-btn').innerHTML = K.frag(ic('menu', 24)); $('#search-ic').innerHTML = K.frag(ic('search', 18));
    $('#q').placeholder = t('Поиск по медиатеке'); $('#conn-t').textContent = t('Подключено');
    $('#scan').innerHTML = '<i></i><span></span>';
    $('#offline').innerHTML = K.frag(html`${ic('plug', 20)}<span>${t('Нет связи с Kodi. Пробую переподключиться…')}</span>`);
    $('#searchf').addEventListener('submit', function (e) { e.preventDefault(); var v = $('#q').value.trim(); if (v) K.go('/search?q=' + encodeURIComponent(v)); });
    $('#search-ic').addEventListener('click', function () { $('#searchf').classList.toggle('open'); if ($('#searchf').classList.contains('open')) $('#q').focus(); });
    document.addEventListener('click', function (e) { if (!e.target.closest('#searchf')) $('#searchf').classList.remove('open'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
    });
    K.on('offline', function () { $('#conn-t').textContent = t('Нет связи'); }); K.on('online', function () { $('#conn-t').textContent = t('Подключено'); });
    $('#conn').addEventListener('click', function () { K.toast((K.st.verText || 'Kodi') + ' · ' + location.hostname, 'ok'); });
  }
  K.on('target', function () { if (K.paintTarget) K.paintTarget(); });

  K.start = function () {
    initTop();
    K.rpc('Application.GetProperties', { properties: ['name', 'version'] }).then(function (a) {
      var v = a.version || {}; K.st.ver = v; K.st.verText = a.name + ' ' + v.major + '.' + v.minor; drawNav();
    }).catch(function () { });
    K.rpc('XBMC.GetInfoBooleans', { booleans: ['Pvr.HasTVChannels', 'Pvr.HasRadioChannels'] }).then(function (b) {
      K.st.nopvr = !(b['Pvr.HasTVChannels'] || b['Pvr.HasRadioChannels']); drawNav();
    }).catch(function () { K.st.nopvr = true; });
    if (K.be) K.be.init();
    K.route(); K.player.start(); poll();
    (function () {
      var btn = document.getElementById('totop');
      if (!btn) return;
      window.addEventListener('scroll', function () {
        btn.style.display = (window.scrollY > 400) ? 'grid' : 'none';
      }, { passive: true });
      btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    })();
  };
})();

