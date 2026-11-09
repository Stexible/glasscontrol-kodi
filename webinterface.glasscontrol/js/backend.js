/* Glass Control — клиент серверной части (service.glasscontrol): файловый менеджер, источники, установка дополнений */
(function () {
  'use strict';
  var K = window.K;
  var B = K.be = { ok: false, caps: null, base: '', token: '', tried: false, _p: null };
  B.init = function () {
    if (B._p) return B._p;
    B._p = K.rpc('XBMC.GetInfoLabels', { labels: ['Window(Home).Property(glasscontrol.token)', 'Window(Home).Property(glasscontrol.port)'] }).then(function (l) {
      var tok = l['Window(Home).Property(glasscontrol.token)'], port = l['Window(Home).Property(glasscontrol.port)'];
      B.tried = true;
      if (!tok || !port) { B.ok = false; return false; }
      B.token = tok; B.base = location.protocol + '//' + location.hostname + ':' + port;
      return fetch(B.base + '/api/caps', { headers: { 'X-Token': tok }, cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (c) {
        B.caps = c; B.ok = true; K.emit('be', true); return true;
      }).catch(function () { B.ok = false; B.unreachable = true; return false; });
    }).catch(function () { B.tried = true; B.ok = false; return false; });
    return B._p;
  };
  B.retry = function () { B._p = null; return B.init(); };
  function post(path, body) {
    return fetch(B.base + path, { method: 'POST', headers: { 'X-Token': B.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }, function () { return { r: r, j: {} }; }); }, function () { throw new Error(K.t('Серверная часть недоступна (порт заблокирован?)')); });
  }
  /* токен меняется при каждом старте службы (перезапуск Kodi/профиля): при 401 берём свежий и повторяем один раз */
  B.call = function (path, body) {
    if (!B.ok) return Promise.reject(new Error(K.t('Серверная часть не установлена')));
    return post(path, body).then(function (x) {
      if (x.r.status !== 401) return x;
      return B.retry().then(function (ok) { if (!ok) throw new Error(K.t('Серверная часть недоступна (порт заблокирован?)')); return post(path, body); });
    }).then(function (x) { if (!x.r.ok) throw new Error(x.j.error || ('HTTP ' + x.r.status)); return x.j; });
  };
  /* подсказка, когда бэкенда нет */
  B.hint = function () {
    return K.html`<div class="hint">${K.ic('plug', 20)}<div>${B.unreachable ? K.t('Серверная часть установлена, но её порт недоступен из браузера.') : K.t('Для этой функции нужен дополнительный компонент «Glass Control Backend» (service.glasscontrol): установите его из zip и перезапустите Kodi.')} <a class="lnk" data-act="berety">${K.t('Проверить снова')}</a></div></div>`;
  };
  K.acts.berety = function () { return B.retry().then(function (ok) { K.toast(ok ? K.t('Серверная часть найдена') : K.t('Серверная часть не найдена'), ok ? 'ok' : 'err'); if (ok) K.route(true); }); };
})();
