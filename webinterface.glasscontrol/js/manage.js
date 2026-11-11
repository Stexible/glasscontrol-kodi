/* Glass Control — управление: дополнения, настройки, пульт, система */
(function () {
  'use strict';
  var K = window.K, t = K.t, html = K.html, ic = K.ic, raw = K.raw, $ = K.$;

  /* ================= Дополнения ================= */
  var AFIELDS = ['name', 'version', 'summary', 'description', 'author', 'thumbnail', 'enabled', 'broken', 'rating', 'dependencies', 'path'];
  function acat(a) {
    var ty = a.type || '';
    if (ty === 'xbmc.python.pluginsource') return 'plugin'; if (ty === 'xbmc.python.script' || ty === 'xbmc.python.weather' || ty === 'xbmc.python.lyrics') return 'script';
    if (ty === 'xbmc.service') return 'service'; if (ty === 'xbmc.gui.skin') return 'skin'; if (ty === 'xbmc.addon.repository') return 'repo';
    if (/^kodi\.resource/.test(ty) || /^xbmc\.gui\.(webinterface|font)/.test(ty)) return 'res'; if (ty === 'xbmc.webinterface') return 'web';
    if (/scraper/.test(ty)) return 'scraper'; return 'other';
  }
  var ACATS = [['all', 'Все'], ['plugin', 'Плагины'], ['script', 'Скрипты'], ['service', 'Службы'], ['skin', 'Скины'], ['repo', 'Репозитории'], ['scraper', 'Скрапперы'], ['res', 'Ресурсы'], ['web', 'Веб'], ['other', 'Прочее']];
  K.pages.addons = { title: function () { return t('Дополнения'); }, render: function (ctx) {
    var cat = ctx.q.c || 'all', st = ctx.q.st || '', s = (ctx.q.s || '').toLowerCase();
    return K.rpc('Addons.GetAddons', { installed: true, enabled: 'all', properties: AFIELDS }).then(function (r) {
      if (!ctx.alive()) return; var all = r.addons || []; K.addons = all;
      var cnt = {}; all.forEach(function (a) { var c = acat(a); cnt[c] = (cnt[c] || 0) + 1; });
      var list = all.filter(function (a) { return (cat === 'all' || acat(a) === cat) && (!st || (st === 'on') === !!a.enabled) && (!s || ((a.name || '') + a.addonid).toLowerCase().indexOf(s) >= 0); })
        .sort(function (a, b) { return (a.name || a.addonid).localeCompare(b.name || b.addonid); });
      K.mount(ctx.view, html`${K.ui.head(t('Дополнения'), { sub: all.length + ' ' + t('установлено'), right: html`<button class="btn sm" data-act="addonbrowser">${ic('plus', 16)} ${t('Каталог на экране Kodi')}</button>` })}
        <div class="chips">${ACATS.filter(function (c) { return c[0] === 'all' || cnt[c[0]]; }).map(function (c) { return html`<button class="chip ${c[0] === cat ? 'on' : ''}" data-act="qset2" data-k="c" data-v="${c[0] === 'all' ? '' : c[0]}">${t(c[1])} <small>${c[0] === 'all' ? all.length : cnt[c[0]]}</small></button>`; })}</div>
        <div class="toolbar"><label class="search sm"><span>${ic('search', 16)}</span><input id="lf" type="search" placeholder="${t('Фильтр по названию')}" value="${ctx.q.s || ''}"></label>
          ${K.ui.seg([['', t('Все')], ['on', t('Включены')], ['off', t('Выключены')]], st, 'qset2', 'data-k="st"')}</div>
        <div class="addons">${list.map(function (a) {
          var run = ['plugin', 'script'].indexOf(acat(a)) >= 0 || /executable|program/.test(a.type || '');
          return html`<div class="glass addon ${a.enabled ? '' : 'off'}"><a class="addon-i" data-act="addoninfo" data-id="${a.addonid}">${a.thumbnail ? html`<img loading="lazy" src="${K.img(a.thumbnail)}" alt="" onerror="this.remove()">` : ic('box', 28)}</a>
            <div class="addon-m"><b>${a.name || a.addonid}</b><small>${a.version}${a.author ? ' · ' + a.author : ''}</small><p>${a.summary || ''}</p></div>
            <div class="addon-a">${run && a.enabled ? html`<button class="icon-btn" data-act="addonrun" data-id="${a.addonid}" aria-label="${t('Запустить')}">${ic('play', 18)}</button>` : ''}
              <button class="icon-btn" data-act="addoninfo" data-id="${a.addonid}" aria-label="${t('Подробнее')}">${ic('info', 18)}</button>
              ${K.ui.sw(a.enabled, 'data-act="addontoggle" data-id="' + a.addonid + '"')}</div></div>`; })}</div>
        ${list.length ? '' : K.ui.empty('box', t('Ничего не найдено'))}`);
    });
  } };
  K.acts.qset2 = function (el) { var q = {}; Object.keys(K.cur.q).forEach(function (k) { q[k] = K.cur.q[k]; }); if (el.dataset.v) q[el.dataset.k] = el.dataset.v; else delete q[el.dataset.k]; K.go(K.cur.path + '?' + Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&')); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'lf' && K.cur.path === '/addons') K.acts.qset2({ dataset: { k: 's', v: e.target.value.trim() } }); });
  function ad(id) { return (K.addons || []).filter(function (a) { return a.addonid === id; })[0] || {}; }
  K.acts.addontoggle = function (el) {
    var a = ad(el.dataset.id), on = !a.enabled;
    return K.rpc('Addons.SetAddonEnabled', { addonid: a.addonid, enabled: on }).then(function () { a.enabled = on; el.classList.toggle('on', on); el.setAttribute('aria-checked', on); var c = el.closest('.addon'); if (c) c.classList.toggle('off', !on); K.toast(on ? t('Включено') : t('Выключено'), 'ok'); });
  };
  K.acts.addonrun = function (el) { return K.rpc('Addons.ExecuteAddon', { addonid: el.dataset.id }).then(function () { K.toast(t('Запущено на экране Kodi'), 'ok'); }); };
  K.acts.addonbrowser = function () { return K.rpc('GUI.ActivateWindow', { window: 'addonbrowser' }).then(function () { K.toast(t('Открыто на экране Kodi'), 'ok'); }); };
  K.acts.addoninfo = function (el) {
    var a = ad(el.dataset.id);
    K.ui.modal({ title: a.name || a.addonid, body: html`<dl class="kv">
      <div><dt>ID</dt><dd>${a.addonid}</dd></div><div><dt>${t('Версия')}</dt><dd>${a.version}</dd></div><div><dt>${t('Тип')}</dt><dd>${a.type}</dd></div>
      ${a.author ? html`<div><dt>${t('Автор')}</dt><dd>${a.author}</dd></div>` : ''}${a.path ? html`<div><dt>${t('Путь')}</dt><dd>${a.path}</dd></div>` : ''}
      ${(a.dependencies || []).length ? html`<div><dt>${t('Зависимости')}</dt><dd>${a.dependencies.map(function (d) { return d.addonid + (d.optional ? '?' : ''); }).join(', ')}</dd></div>` : ''}</dl>
      ${a.description || a.summary ? html`<p class="plot" style="margin-top:14px">${a.description || a.summary}</p>` : ''}
      <p class="note">${t('Установка, обновление и удаление дополнений недоступны через API Kodi. Откройте каталог на экране Kodi.')}</p>` });
  };

  /* ================= Настройки ================= */
  var LEVELS = [['basic', 'Базовый'], ['standard', 'Стандартный'], ['advanced', 'Расширенный'], ['expert', 'Эксперт']];
  K.pend = K.pend || {}; K.sets = K.sets || {};
  var EXTRA = [['look', 'Оформление'], ['web', 'Веб-сервер'], ['net', 'Сеть'], ['skin', 'Скин']];
  function extraTabs(cur) { return EXTRA.map(function (x) { return html`<a class="${x[0] === cur ? 'on' : ''}" href="#/settings/${x[0]}">${t(x[1])}</a>`; }); }
  K.pages.settings = { title: function () { return t('Настройки'); }, render: function (ctx) {
    var level = K.store.get('level', 'standard'), sec = ctx.args[0], cat = ctx.args[1];
    if (sec === 'skin') return skinPage(ctx);
    if (sec === 'look') return lookPage(ctx);
    if (sec === 'web') return groupPage(ctx, 'web', t('Веб-сервер'), t('Доступ к Kodi по сети'), [['services', 'control']]);
    if (sec === 'net') return groupPage(ctx, 'net', t('Сеть'), t('Подключение и прокси'), [['system', 'network']], true);
    return K.rpc('Settings.GetSections', { level: level, properties: ['categories'] }).then(function (r) {
      if (!ctx.alive()) return; var secs = r.sections || [];
      if (!sec) { sec = secs[0] && secs[0].id; }
      var cur = secs.filter(function (s) { return s.id === sec; })[0] || secs[0] || { categories: [] };
      if (!cat) cat = cur.categories[0] && cur.categories[0].id;
      var head = html`${K.ui.head(t('Настройки'), { sub: t('Системные настройки Kodi'), right: html`<div class="grp">${K.ui.select(LEVELS.map(function (l) { return [l[0], t(l[1])]; }), level, 'data-change="setlevel"')}</div>` })}
        <div class="tabs">${secs.map(function (s) { return html`<a class="${s.id === sec ? 'on' : ''}" href="#/settings/${s.id}">${s.label}</a>`; })}${extraTabs('')}</div>`;
      K.mount(ctx.view, html`${head}<div class="split"><div class="glass panel setnav">${cur.categories.map(function (c) { return html`<a class="${c.id === cat ? 'on' : ''}" href="#/settings/${cur.id}/${c.id}">${c.label}</a>`; })}</div><div class="glass panel setbody" id="setbody">${K.ui.loading()}</div></div>${saveBar()}`);
      if (!cat) return;
      return K.rpc('Settings.GetSettings', { level: level, filter: { section: cur.id, category: cat } }).then(function (g) {
        if (!ctx.alive()) return; var list = g.settings || [];
        list.forEach(function (s) { K.sets[s.id] = s; });
        K.mount($('#setbody'), list.length ? html`${list.map(settingRow)}${cur.id === 'system' && cat === 'powermanagement' ? html`<p class="note">${t('«Выключать экран во время простоя» задаётся в минутах (0 — никогда). На Android и многих устройствах Kodi не управляет подсветкой экрана, поэтому эта настройка может не срабатывать — используйте системные настройки Android.')}</p>` : ''}` : K.ui.empty('sliders', t('Нет настроек на этом уровне')));
        updSave();
      });
    });
  } };
  /* страница из отдельных категорий Kodi */
  function groupPage(ctx, key, title, sub, cats, netinfo) {
    var level = K.store.get('level', 'standard');
    return Promise.all([K.rpc('Settings.GetSections', { level: level, properties: ['categories'] })].concat(cats.map(function (c) { return K.rpc('Settings.GetSettings', { level: level, filter: { section: c[0], category: c[1] } }); }))).then(function (all) {
      if (!ctx.alive()) return; var secs = (all[0].sections || []); var rs = all.slice(1);
      var list = [].concat.apply([], rs.map(function (g) { return g.settings || []; }));
      list.forEach(function (s) { K.sets[s.id] = s; });
      var net = netinfo ? html`<div class="glass panel" id="netinfo" style="margin-bottom:14px">${K.ui.loading()}</div>` : '';
      K.mount(ctx.view, html`${K.ui.head(title, { sub: sub })}<div class="tabs">${secs.map(function (s) { return html`<a href="#/settings/${s.id}">${s.label}</a>`; })}${extraTabs(key)}</div>${net}
        <div class="glass panel setbody">${list.length ? list.map(settingRow) : K.ui.empty('sliders', t('Нет настроек на этом уровне'))}</div>${saveBar()}`);
      updSave();
      if (netinfo) K.rpc('XBMC.GetInfoLabels', { labels: ['Network.IPAddress', 'Network.MacAddress', 'Network.LinkState', 'Network.SubnetMask', 'Network.GatewayAddress', 'Network.DNS1Address', 'System.FriendlyName'] }).then(function (L) {
        var rows = [[t('Имя устройства'), L['System.FriendlyName']], [t('IP-адрес'), L['Network.IPAddress']], [t('MAC'), L['Network.MacAddress']], [t('Состояние'), L['Network.LinkState']], [t('Маска'), L['Network.SubnetMask']], [t('Шлюз'), L['Network.GatewayAddress']], ['DNS', L['Network.DNS1Address']]].filter(function (x) { return x[1]; });
        var b = $('#netinfo'); if (b) K.mount(b, html`<h3 class="ph3">${t('Текущее подключение')}</h3><dl class="kv">${rows.map(function (x) { return html`<div><dt>${x[0]}</dt><dd>${x[1]}</dd></div>`; })}</dl><p class="note">${t('Wi-Fi и сеть Android настраиваются в системных настройках устройства; Kodi управляет только прокси и пропускной способностью.')}</p>`);
      }).catch(function () {});
    });
  }
  /* оформление этого интерфейса */
  function lookPage(ctx) {
    var mode = K.theme.mode, acc = K.theme.accent;
    var level = K.store.get('level', 'standard');
    K.rpc('Settings.GetSections', { level: level, properties: ['categories'] }).then(function (r) {
      if (!ctx.alive()) return; var secs = r.sections || [];
      K.mount(ctx.view, html`${K.ui.head(t('Настройки'), { sub: t('Оформление интерфейса') })}<div class="tabs">${secs.map(function (s) { return html`<a href="#/settings/${s.id}">${s.label}</a>`; })}${extraTabs('look')}</div>
      <div class="glass panel"><h3 class="ph3">${t('Тема')}</h3>${K.ui.seg([['dark', t('Тёмная')], ['light', t('Светлая')], ['auto', t('Авто')]], mode, 'themeset')}
        <h3 class="ph3" style="margin-top:22px">${t('Акцентный цвет')}</h3><div class="swatches">${K.ACCENTS.map(function (a) { return html`<button class="swatch ${a.id === acc ? 'on' : ''}" data-act="accset" data-v="${a.id}" style="--c:rgb(${a.ac.join(',')})" aria-label="${a.id}" title="${a.id}"><i></i></button>`; })}</div>
        <div class="glass panel" style="margin-top:14px"><h3 class="ph3">${t('Видимость пунктов меню')}</h3>
        <div class="chips tight">${(K.NAV || []).filter(function (x) { return x && x !== 0 && x[0] !== '/settings'; }).map(function (x) {
          var hiddenDefault = (K.st && K.st.nopvr && x[0] === '/pvr') ? ['/pvr'] : [];
          var hidden = (K.store.get('hiddenNav', hiddenDefault) || []).indexOf(x[0]) >= 0;
          return html`<button class="chip ${hidden ? '' : 'on'}" data-act="navtoggle" data-v="${x[0]}">${ic(x[1], 16)} ${t(x[2])}</button>`;
        })}</div>
        <p class="note">${t('Скрытые пункты не будут отображаться в боковом меню и нижней панели. Настройки хранятся в браузере.')}</p></div>
      <div class="glass panel" style="margin-top:14px"><h3 class="ph3">${t('События в реальном времени')}</h3><label class="field"><span>${t('Порт событий (WebSocket, TCP)')}</span><div class="grp"><input class="inp" id="wsp" type="number" value="${K.store.get('wsport', 9090)}"><button class="btn" data-act="wsport">OK</button></div></label>
        <p class="note">${K.events && K.events.ok ? t('События в реальном времени: подключено') : t('События: нет WebSocket — используется периодический опрос. Включите «Разрешить управление с других систем» в Настройки → Службы → Управление.')}</p></div>`);
    });
  }
  K.acts.themeset = function (el) { K.theme.set('theme', el.dataset.v); K.route(true); };
  K.acts.accset = function (el) { K.theme.set('accent', el.dataset.v); K.route(true); };
  K.acts.navtoggle = function (el) {
    var v = el.dataset.v, hidden = K.store.get('hiddenNav', []) || [], i = hidden.indexOf(v);
    if (i >= 0) hidden.splice(i, 1); else hidden.push(v);
    K.store.set('hiddenNav', hidden);
    el.classList.toggle('on', i >= 0);
    K.drawNav && K.drawNav();
  };
  K.acts.setlevel = function (el) { K.store.set('level', el.value); K.route(true); };

  /* форматирование значения: formatlabel («{0:d} мин», «%i min») и подпись минимума («Никогда») */
  function fmtVal(s, v) {
    var c = s.control || {};
    if (c.minimumlabel && s.minimum != null && +v === +s.minimum) return c.minimumlabel;
    var f = c.formatlabel;
    if (f && /\{0|%[0-9.]*[dis]|%[0-9.]*f/.test(f)) return f.replace(/\{0[^}]*\}|%[0-9.]*[disf]/, String(v));
    return f && /^\s*$/.test(f) ? String(v) : (f ? f : String(v));
  }
  function cur(s) { return Object.prototype.hasOwnProperty.call(K.pend, s.id) ? K.pend[s.id] : s.value; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function settingRow(s) {
    var c = s.control || {}, id = s.id, v = cur(s), dis = s.enabled === false ? 'disabled' : '', ctl = '';
    var ch = 'data-change="pchg" data-id="' + id + '" ' + dis;
    if (s.type === 'action') return '';
    if (s.type === 'boolean') ctl = K.ui.sw(v, 'data-act="ptog" data-id="' + id + '" ' + dis);
    else if (s.type === 'list') {
      var opts = (s.definition && s.definition.options) || [];
      if (opts.length) ctl = html`<div class="chips tight">${opts.map(function (o) { var on = (v || []).indexOf(o.value) >= 0; return html`<button class="chip ${on ? 'on' : ''}" data-act="plist" data-id="${id}" data-v="${o.value}" ${raw(dis)}>${on ? ic('check', 14) : ''} ${o.label}</button>`; })}</div>`;
      else ctl = html`<input class="inp" type="text" value="${(v || []).join(s.delimiter || ',')}" ${raw(ch)} data-list="1" data-delim="${s.delimiter || ','}" data-et="${s.elementtype}">`;
    }
    else if (s.options && s.options.length) ctl = K.ui.select(s.options.map(function (o) { return [o.value, o.label]; }), v, ch);
    else if (s.type === 'integer' || s.type === 'number') {
      var step = s.step || (s.type === 'number' ? 0.1 : 1), mn = s.minimum, mx = s.maximum, n = mn != null && mx != null ? (mx - mn) / step : 0;
      if (c.type === 'slider' && mn != null && mx != null) ctl = html`<input type="range" min="${mn}" max="${mx}" step="${step}" value="${v}" style="--p:${(v - mn) / (mx - mn) * 100}%" data-input="prange" ${raw(ch)}><span class="row-s" data-sv="${id}">${fmtVal(s, v)}</span>`;
      else if (n > 0 && n <= 400) { var o2 = []; for (var i = 0; i <= n; i++) { var x = Math.round((mn + i * step) * 1000) / 1000; o2.push([x, fmtVal(s, x)]); } if (!o2.some(function (o) { return o[0] === v; })) o2.push([v, fmtVal(s, v)]); ctl = K.ui.select(o2, v, ch); }
      else ctl = html`<input class="inp num" type="number" ${mn != null ? raw('min="' + mn + '"') : ''} ${mx != null ? raw('max="' + mx + '"') : ''} step="${step}" value="${v}" ${raw(ch)}>`;
    }
    else if (s.type === 'addon') ctl = html`<button class="btn sm" data-act="setaddon" data-id="${id}" data-t="${s.addontype}" ${raw(dis)}>${v || t('Не выбрано')}</button>`;
    else ctl = html`<input class="inp" type="${c.hidden ? 'password' : 'text'}" value="${v}" ${raw(ch)}>`;
    var isDef = same(v, s.default);
    return html`<div class="setrow ${s.enabled === false ? 'off' : ''} ${Object.prototype.hasOwnProperty.call(K.pend, id) ? 'mod' : ''}" data-row="${id}"><div class="setrow-t"><b>${s.label}</b>${s.help ? html`<small>${s.help}</small>` : ''}</div>
      <div class="setrow-c">${ctl}<button class="icon-btn hov" data-act="setreset" data-id="${id}" ${isDef ? raw('style="visibility:hidden"') : ''} aria-label="${t('По умолчанию')}" title="${t('Сбросить')}">${ic('rotate', 16)}</button></div></div>`;
  }
  function saveBar() { return html`<div id="savebar" class="savebar glass" hidden><span id="savecnt"></span><button class="btn" data-act="pdiscard">${t('Отменить')}</button><button class="btn primary" data-act="psave">${ic('check', 16)} ${t('Сохранить изменения')}</button></div>`; }
  function updSave() {
    var n = Object.keys(K.pend).length, b = $('#savebar'); if (!b) return;
    b.hidden = !n; var c = $('#savecnt'); if (c) c.textContent = t('Изменено') + ': ' + n;
  }
  function setPend(id, v) {
    var s = K.sets[id]; if (!s || (typeof v === 'number' && isNaN(v))) return;
    if (same(v, s.value)) delete K.pend[id]; else K.pend[id] = v;
    var row = document.querySelector('[data-row="' + id + '"]'); if (row) { row.classList.toggle('mod', id in K.pend); var r = row.querySelector('[data-act=setreset]'); if (r) r.style.visibility = same(v, s.default) ? 'hidden' : ''; }
    updSave();
  }
  K.acts.pchg = function (el) {
    var s = K.sets[el.dataset.id], v = el.value;
    if (el.dataset.list) { var et = el.dataset.et; v = v.split(el.dataset.delim).map(function (x) { x = x.trim(); return et === 'integer' ? parseInt(x, 10) : et === 'number' ? parseFloat(x) : x; }).filter(function (x) { return x !== '' && !(typeof x === 'number' && isNaN(x)); }); }
    else if (s.type === 'integer') v = parseInt(v, 10); else if (s.type === 'number') v = parseFloat(v);
    setPend(s.id, v);
  };
  K.acts.prange = function (el) {
    var s = K.sets[el.dataset.id], mn = +el.min, mx = +el.max; el.style.setProperty('--p', (el.value - mn) / (mx - mn) * 100 + '%');
    var v = s.type === 'number' ? parseFloat(el.value) : parseInt(el.value, 10), l = $('[data-sv="' + s.id + '"]'); if (l) l.textContent = fmtVal(s, v); setPend(s.id, v);
  };
  K.acts.ptog = function (el) { var s = K.sets[el.dataset.id], v = !cur(s); el.classList.toggle('on', v); el.setAttribute('aria-checked', v); setPend(s.id, v); };
  K.acts.plist = function (el) {
    var s = K.sets[el.dataset.id], v = (cur(s) || []).slice(), o = (s.definition.options || []).filter(function (x) { return String(x.value) === el.dataset.v; })[0], val = o ? o.value : el.dataset.v, i = v.indexOf(val);
    if (i >= 0) v.splice(i, 1); else v.push(val); setPend(s.id, v); el.classList.toggle('on', i < 0);
  };
  K.acts.pdiscard = function () { K.pend = {}; K.route(true); };
  K.acts.psave = function () {
    var ids = Object.keys(K.pend); if (!ids.length) return;
    return K.batch(ids.map(function (id) { return ['Settings.SetSettingValue', { setting: id, value: K.pend[id] }]; })).then(function (r) {
      var bad = []; ids.forEach(function (id, i) { if (K.ok(r[i])) delete K.pend[id]; else bad.push((K.sets[id] ? K.sets[id].label : id)); });
      if (bad.length) K.toast(t('Не удалось сохранить') + ': ' + bad.join(', '), 'err'); else K.toast(t('Изменения сохранены'), 'ok');
      K.route(true);
    });
  };
  K.acts.setreset = function (el) { delete K.pend[el.dataset.id]; return K.rpc('Settings.ResetSettingValue', { setting: el.dataset.id }).then(function () { K.toast(t('Сброшено'), 'ok'); K.route(true); }); };
  K.acts.setaddon = function (el) {
    var s = K.sets[el.dataset.id];
    return K.rpc('Addons.GetAddons', { type: el.dataset.t, enabled: true, properties: ['name'] }).then(function (r) {
      var l = r.addons || []; if (!l.length) return K.toast(t('Подходящих дополнений нет'), 'err');
      K.ui.menu(s.label, l.map(function (a) { return { icon: 'box', label: a.name || a.addonid, sub: a.addonid, run: function () { setPend(s.id, a.addonid); var b = document.querySelector('[data-row="' + s.id + '"] [data-act=setaddon]'); if (b) b.textContent = a.addonid; } }; }));
    });
  };
  function skinPage(ctx) {
    var level = K.store.get('level', 'standard');
    return Promise.all([K.rpc('Settings.GetSkinSettings'), K.rpc('Settings.GetSections', { level: level, properties: ['categories'] })]).then(function (all) {
      if (!ctx.alive()) return; var r = all[0], secs = all[1].sections || []; var l = (r.settings || []).sort(function (a, b) { return a.id.localeCompare(b.id); }); K.skin = {}; l.forEach(function (s) { K.skin[s.id] = s; });
      K.mount(ctx.view, html`${K.ui.head(t('Настройки'), { sub: t('Скин') + ': ' + r.skin })}<div class="tabs">${secs.map(function (s) { return html`<a href="#/settings/${s.id}">${s.label}</a>`; })}${extraTabs('skin')}</div>
        <div class="glass panel">${l.length ? l.map(function (s) {
          return html`<div class="setrow"><div class="setrow-t"><b>${s.id}</b></div><div class="setrow-c">${s.type === 'boolean' ? K.ui.sw(s.value, 'data-act="skintog" data-id="' + s.id + '"') : html`<input class="inp" type="text" value="${s.value}" data-change="skinv" data-id="${s.id}">`}</div></div>`; }) : K.ui.empty('sliders', t('У скина нет настроек'))}</div>`);
    });
  }
  K.acts.skintog = function (el) { var s = K.skin[el.dataset.id], v = !s.value; return K.rpc('Settings.SetSkinSettingValue', { setting: s.id, value: v }).then(function () { s.value = v; el.classList.toggle('on', v); el.setAttribute('aria-checked', v); K.toast(t('Сохранено'), 'ok'); }); };
  K.acts.skinv = function (el) { return K.rpc('Settings.SetSkinSettingValue', { setting: el.dataset.id, value: el.value }).then(function () { K.toast(t('Сохранено'), 'ok'); }); };

  /* ================= Пульт ================= */
  function inp(m) { return function () { return K.rpc('Input.' + m); }; }
  ['Up', 'Down', 'Left', 'Right', 'Select', 'Back', 'Home', 'ContextMenu', 'Info', 'ShowOSD', 'ShowPlayerProcessInfo'].forEach(function (m) { K.acts['in' + m] = inp(m); });
  K.acts.inact = function (el) { return K.rpc('Input.ExecuteAction', { action: el.dataset.v }); };
  K.acts.sendtext = function () { var i = $('#rtext'); if (!i.value) return; return K.rpc('Input.SendText', { text: i.value, done: true }).then(function () { i.value = ''; }); };
  K.acts.rwin = function (el) { return K.rpc('GUI.ActivateWindow', { window: el.dataset.v }); };
  var rpt = null;
  K.pages.remote = { title: function () { return t('Пульт'); }, render: function (ctx) {
    var b = function (act, icon, v, label, cls) { return html`<button class="pad ${cls || ''}" data-act="${act}" ${v ? raw('data-v="' + v + '"') : ''} aria-label="${label}">${ic(icon, 24)}</button>`; };
    K.mount(ctx.view, html`${K.ui.head(t('Пульт'), { sub: t('Управление интерфейсом Kodi') })}
      <div class="remote">
        <div class="glass panel dpadbox"><div class="dpad">${b('inUp', 'up', '', t('Вверх'), 'u')}${b('inLeft', 'left', '', t('Влево'), 'l')}<button class="pad ok" data-act="inSelect">OK</button>${b('inRight', 'right', '', t('Вправо'), 'r')}${b('inDown', 'down', '', t('Вниз'), 'd')}</div>
          <div class="pad-row">${b('inBack', 'back', '', t('Назад'))}${b('inHome', 'home', '', t('Домой'))}${b('inContextMenu', 'menu', '', t('Меню'))}${b('inInfo', 'info', '', t('Инфо'))}</div></div>
        <div class="glass panel">
          <div class="pad-row">${b('prev', 'prev', '', t('Предыдущий'))}${b('step', 'rew', 'smallbackward', t('Назад'))}<button class="pad big" data-act="pp">${ic('play', 24)}</button>${b('step', 'ff', 'smallforward', t('Вперёд'))}${b('next', 'next', '', t('Следующий'))}</div>
          <div class="pad-row">${b('stop', 'stop', '', t('Стоп'))}${b('vol', 'volume', 'down', t('Тише'))}${b('mute', 'mute', '', t('Без звука'))}${b('vol', 'volume', 'up', t('Громче'))}${b('fullscreen', 'fullscreen', '', t('На весь экран'))}</div>
          <div class="pad-row">${b('inact', 'subs', 'showsubtitles', t('Субтитры'))}${b('inact', 'audio', 'audionextlanguage', t('Аудиодорожка'))}${b('inShowOSD', 'sliders', '', 'OSD')}${b('inact', 'image', 'screenshot', t('Скриншот'))}</div>
          <div class="swipe" id="swipe">${ic('remote', 28)}<span>${t('Свайп — стрелки, касание — OK')}</span></div></div>
        <div class="glass panel" id="rscreen"></div>
        <div class="glass panel"><label class="field"><span>${t('Ввод текста на экране Kodi')}</span><div class="grp"><input class="inp" id="rtext" type="text" placeholder="${t('Введите текст…')}"><button class="btn primary" data-act="sendtext">${ic('keyboard', 16)}</button></div></label>
          <div class="chips" style="margin-top:14px">${[['home', 'Главная'], ['videos', 'Видео'], ['music', 'Музыка'], ['pictures', 'Фото'], ['settings', 'Настройки'], ['addonbrowser', 'Дополнения'], ['favourites', 'Избранное']].map(function (w) { return html`<button class="chip" data-act="rwin" data-v="${w[0]}">${t(w[1])}</button>`; })}</div></div>
      </div>`);
    K.be.init().then(function () {
      if (!ctx.alive()) return; var bx = $('#rscreen'); if (!bx) return;
      var tg = K.target ? K.target() : 'kodi';
      var out = html`<h3 class="ph3">${t('Куда воспроизводить')}</h3>${K.ui.seg([['kodi', t('На Kodi')], ['browser', t('В этом браузере')]], tg, 'settarget')}<p class="note">${t('«В браузере»: звук и видео играют на этом устройстве (форматы — какие поддерживает браузер).')}</p>`;
      if (!K.be.ok) { K.mount(bx, html`${out}<h3 class="ph3" style="margin-top:22px">${t('Экран')}</h3>${K.be.hint()}`); return; }
      K.mount(bx, html`${out}<h3 class="ph3" style="margin-top:22px">${t('Экран устройства')}</h3>
        <div class="btns"><button class="btn" data-act="scroff">${ic('moon', 16)} ${t('Погасить экран (заставка)')}</button></div>
        <div id="brt" style="margin-top:14px"></div><p class="note">${t('Воспроизведение при этом не останавливается. Заставка включается только пока Kodi в фокусе; любое касание экрана — выход.')}</p>`);
      if (K.be.caps && K.be.caps.brightness) K.be.call('/api/brightness', {}).then(function (b) {
        var bb = $('#brt'); if (b.supported && bb) K.mount(bb, html`<label class="field"><span>${t('Яркость экрана')}: <b data-sv="brt">${b.value}%</b></span><input type="range" min="1" max="100" value="${b.value}" style="--p:${b.value}%" data-input="brtset"></label>`);
      }).catch(function () {});
    });
    var sw = $('#swipe'), x0, y0, t0;
    function hit(e) { var b = e.target.closest('.pad'); if (!b) return; b.classList.add('hit'); var d = b.closest('.dpad'); if (d) { var c = (b.className.match(/\b([udlr])\b/) || [])[1]; if (c) d.classList.add('hit-' + c); setTimeout(function () { d.classList.remove('hit-' + c); }, 260); } setTimeout(function () { b.classList.remove('hit'); }, 260); if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) { /* нет */ } }
    ctx.view.addEventListener('pointerdown', hit);
    sw.addEventListener('pointerdown', function () { sw.classList.add('hit'); setTimeout(function () { sw.classList.remove('hit'); }, 240); });
    sw.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); sw.setPointerCapture(e.pointerId); });
    sw.addEventListener('pointerup', function (e) {
      var dx = e.clientX - x0, dy = e.clientY - y0, ax = Math.abs(dx), ay = Math.abs(dy), m;
      if (Math.max(ax, ay) < 18) m = Date.now() - t0 > 500 ? 'ContextMenu' : 'Select'; else m = ax > ay ? (dx > 0 ? 'Right' : 'Left') : (dy > 0 ? 'Down' : 'Up');
      K.rpc('Input.' + m).catch(K.err);
    });
    /* клавиатура ПК */
    function key(e) {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey) return;
      var m = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Enter: 'Select', Backspace: 'Back', Escape: 'Back' }[e.key];
      if (m) { e.preventDefault(); K.rpc('Input.' + m).catch(K.err); } else if (e.key === ' ') { e.preventDefault(); K.acts.pp(); }
    }
    document.addEventListener('keydown', key); ctx.cleanup.push(function () { document.removeEventListener('keydown', key); });
  } };

  /* ================= Система ================= */
  var LBL = ['System.BuildVersion', 'System.BuildDate', 'System.FriendlyName', 'System.OSVersionInfo', 'System.CpuUsage', 'System.Memory(used.percent)', 'System.Uptime', 'System.TotalUptime', 'System.FreeSpace', 'System.TotalSpace', 'System.ScreenResolution', 'System.Language', 'Network.IPAddress', 'Network.MacAddress', 'System.CPUTemperature', 'System.GPUTemperature', 'System.BatteryLevel'];
  K.pages.system = { title: function () { return t('Система'); }, render: function (ctx) {
    return K.batch([['XBMC.GetInfoLabels', { labels: LBL }], ['System.GetProperties', { properties: ['canshutdown', 'cansuspend', 'canhibernate', 'canreboot'] }], ['Profiles.GetProfiles', { properties: ['lockmode'] }],
      ['Application.GetProperties', { properties: ['name', 'version', 'volume', 'muted'] }], ['GUI.GetProperties', { properties: ['skin', 'currentwindow'] }], ['JSONRPC.Version', {}]]).then(function (r) {
      if (!ctx.alive()) return; var L = K.ok(r[0]) ? r[0] : {}, P = K.ok(r[1]) ? r[1] : {}, pf = K.ok(r[2]) ? (r[2].profiles || []) : [], ap = K.ok(r[3]) ? r[3] : {}, gui = K.ok(r[4]) ? r[4] : {};
      var v = ap.version || {}, info = [[t('Версия'), (ap.name || 'Kodi') + ' ' + (v.major || '') + '.' + (v.minor || '') + (v.tag && v.tag !== 'stable' ? ' ' + v.tag : '')], [t('Сборка'), L['System.BuildVersion']], [t('Имя устройства'), L['System.FriendlyName']], [t('ОС'), L['System.OSVersionInfo']],
        [t('IP-адрес'), L['Network.IPAddress']], [t('Загрузка CPU'), L['System.CpuUsage']], [t('Память'), L['System.Memory(used.percent)']], [t('Температура CPU'), L['System.CPUTemperature']],
        [t('Батарея'), L['System.BatteryLevel']], [t('Свободно'), L['System.FreeSpace']], [t('Время работы'), L['System.Uptime']], [t('Разрешение'), L['System.ScreenResolution']], [t('Скин'), gui.skin ? gui.skin.name || gui.skin.id : '']].filter(function (x) { return x[1]; });
      K.pw = P; K.profiles = pf;
      K.mount(ctx.view, html`${K.ui.head(t('Система'), { sub: t('Информация и обслуживание') })}
        <div class="split cols">
          <div class="glass panel"><h3 class="ph3">${t('О системе')}</h3><dl class="kv">${info.map(function (x) { return html`<div><dt>${x[0]}</dt><dd>${x[1]}</dd></div>`; })}</dl></div>
          <div class="glass panel"><h3 class="ph3">${t('Медиатека')}</h3><div class="btns"><button class="btn primary" data-act="quick" data-v="all">${ic('refresh', 16)} ${t('Быстрое обновление')}</button></div><div class="btns" style="margin-top:12px">
            <button class="btn" data-act="lib" data-v="scanv">${ic('scan', 16)} ${t('Обновить видео')}</button><button class="btn" data-act="lib" data-v="scana">${ic('scan', 16)} ${t('Обновить музыку')}</button>
            <button class="btn" data-act="lib" data-v="cleanv">${ic('eraser', 16)} ${t('Очистить видео')}</button><button class="btn" data-act="lib" data-v="cleana">${ic('eraser', 16)} ${t('Очистить музыку')}</button><button class="btn" data-act="vrestore" title="${t('Вернуть тип содержимого (фильмы/сериалы) и скрапер источников из копии базы')}">${ic('rotate', 16)} ${t('Восстановить содержимое источников')}</button></div>
            <h3 class="ph3" style="margin-top:22px">${t('Уведомление на экране')}</h3><div class="grp"><input class="inp" id="nt" placeholder="${t('Текст уведомления')}"><button class="btn primary" data-act="notify">${ic('bell', 16)}</button></div></div>
          <div class="glass panel"><h3 class="ph3">${t('Питание')}</h3><div class="btns">
            ${P.cansuspend ? html`<button class="btn" data-act="power" data-v="Suspend">${ic('moon', 16)} ${t('Сон')}</button>` : ''}${P.canhibernate ? html`<button class="btn" data-act="power" data-v="Hibernate">${ic('moon', 16)} ${t('Гибернация')}</button>` : ''}
            ${P.canreboot ? html`<button class="btn" data-act="power" data-v="Reboot">${ic('refresh', 16)} ${t('Перезагрузка')}</button>` : ''}${P.canshutdown ? html`<button class="btn danger" data-act="power" data-v="Shutdown">${ic('power', 16)} ${t('Выключить')}</button>` : ''}
            <button class="btn danger" data-act="power" data-v="Quit">${ic('x', 16)} ${t('Закрыть Kodi')}</button></div>
            ${pf.length > 1 ? html`<h3 class="ph3" style="margin-top:22px">${t('Профили')}</h3><div class="chips">${pf.map(function (p) { return html`<button class="chip" data-act="profile" data-v="${p.label}">${ic('user', 16)} ${p.label}</button>`; })}</div>` : ''}</div>
          <div class="glass panel wide"><div class="sec-h" style="margin-top:0"><h3 class="ph3" style="margin:0">${t('Журнал Kodi')}</h3><div class="sec-r"><button class="btn sm" data-act="logload">${ic('refresh', 16)} ${t('Загрузить')}</button></div></div><div id="logwrap"><p class="note">${t('Нажмите «Загрузить», чтобы прочитать kodi.log')}</p></div></div>
        </div>`);
    });
  } };
  K.acts.vrestore = function () {
    return K.be.init().then(function () {
      if (!K.be.ok) return K.toast(t('Нужен Glass Control Backend'), 'err');
      return K.be.call('/api/lib/restore', {}).then(function (r) {
        K.toast(t('Восстановлено источников') + ': ' + r.restored, 'ok');
        return K.ui.confirm(t('Источники восстановлены. Перезапустите Kodi, чтобы они появились в библиотеке.'), { ok: t('Понятно'), cancel: t('Позже') });
      });
    }).catch(K.err);
  };
  K.acts.lib = function (el) {
    var v = el.dataset.v, kind = /v$/.test(v) ? 'video' : 'music';
    return /clean/.test(v) ? K.libClean(kind) : K.libScanOnly(kind);
  };
  K.acts.notify = function () { var i = $('#nt'); if (!i.value) return; return K.rpc('GUI.ShowNotification', { title: 'Glass Control', message: i.value }).then(function () { i.value = ''; K.toast(t('Отправлено'), 'ok'); }); };
  K.acts.power = function (el) {
    var v = el.dataset.v, lab = { Suspend: t('Усыпить устройство?'), Hibernate: t('Перевести в гибернацию?'), Reboot: t('Перезагрузить устройство?'), Shutdown: t('Выключить устройство?'), Quit: t('Закрыть Kodi?') }[v];
    return K.ui.confirm(lab + ' ' + t('Связь с Kodi будет потеряна.'), { danger: true }).then(function (y) { if (!y) return; return K.rpc(v === 'Quit' ? 'Application.Quit' : 'System.' + v); });
  };
  K.acts.profile = function (el) { return K.ui.confirm(t('Переключиться на профиль «{p}»?', { p: el.dataset.v }), {}).then(function (y) { if (y) return K.rpc('Profiles.LoadProfile', { profile: el.dataset.v, prompt: true }); }); };
  K.acts.settarget = function (el) {
    var newV = el.dataset.v;
    if (newV !== K.target()) {
      if (K.target() === 'kodi') {
        if (K.player && K.player.id != null) { var pid = K.player.id; K.player.id = null; K.player.props = null; K.player.item = null; K.rpc('Player.Stop', { playerid: pid }).catch(function () { }); document.body.classList.remove('playing', 'video'); K.emit('player', K.player); }
      } else {
        if (K.local && K.local.i >= 0) K.local.stop();
      }
      K.store.set('target', newV);
      if (K.paintTarget) K.paintTarget();
      K.toast(newV === 'browser' ? t('Воспроизведение: в этом браузере') : t('Воспроизведение: на Kodi'), 'ok');
      K.emit('target');
    }
    K.route(true);
  };
  K.acts.scroff = function () { return K.be.call('/api/exec', { builtin: 'ActivateScreensaver' }).then(function () { K.toast(t('Экран погашен'), 'ok'); }); };
  var brtSend = K.debounce(function (v) { K.be.call('/api/brightness', { value: v }).catch(K.err); }, 150);
  K.acts.brtset = function (el) { el.style.setProperty('--p', el.value + '%'); var l = $('[data-sv="brt"]'); if (l) l.textContent = el.value + '%'; brtSend(+el.value); };
  K.acts.wsport = function () { var v = parseInt($('#wsp').value, 10); K.store.set('wsport', v || 0); if (K.events) K.events.reconnect(); K.toast(t('Сохранено'), 'ok'); };
  var logText = '', logF = 'all';
  function drawLog() {
    var lines = logText.split('\n'), f = logF, out = lines.filter(function (l) { return f === 'all' ? true : f === 'err' ? /ERROR|FATAL|SEVERE/.test(l) : /ERROR|FATAL|SEVERE|WARNING/.test(l); }).slice(-400);
    K.mount($('#logwrap'), html`<div class="toolbar">${K.ui.seg([['all', t('Всё')], ['warn', t('Предупреждения')], ['err', t('Ошибки')]], logF, 'logf')}<a class="btn sm ghost" id="logdl" download="kodi.log">${ic('download', 16)} ${t('Скачать')}</a></div><pre class="logbox">${out.join('\n') || t('Пусто')}</pre>`);
    var b = $('.logbox'); if (b) b.scrollTop = b.scrollHeight; var d = $('#logdl'); if (d) d.href = K.logUrl || '#';
  }
  K.acts.logf = function (el) { logF = el.dataset.v; drawLog(); };
  K.acts.logload = function () {
    return K.rpc('Files.PrepareDownload', { path: 'special://logpath/kodi.log' }).then(function (r) {
      K.logUrl = '/' + r.details.path; return fetch(K.logUrl, { cache: 'no-store' });
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (txt) { logText = txt.length > 600000 ? txt.slice(-600000) : txt; drawLog(); });
  };
})();
