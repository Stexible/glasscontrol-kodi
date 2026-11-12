/* i18n: ключ — русская строка. Для en берётся перевод из K.EN, иначе остаётся русский. */
(function () {
  'use strict';
  var K = window.K = window.K || {};
  K.EN = K.EN || {};
  var saved = null;
  try { saved = localStorage.getItem('glass.lang'); } catch (e) { /* нет хранилища */ }
  K.lang = saved || ((navigator.language || 'ru').toLowerCase().indexOf('ru') === 0 ? 'ru' : 'en');
  K.setLang = function (l) {
    try { localStorage.setItem('glass.lang', l); } catch (e) { /* ignore */ }
    K.lang = l;
    try { if (K.drawNav) K.drawNav(); } catch (e) { /* ignore */ }
    // Не перерисовываем страницу «Сейчас играет» / «Очередь»: иначе сбрасывается встроенный плеер и очередь
    var cur = (K.cur && K.cur.seg && K.cur.seg[0]) || '';
    if (cur !== 'now' && cur !== 'queue') {
      try { K.route(true); } catch (e) { console.error('route err', e); }
    }
  };
  K.t = function (s, p) {
    var r = (K.lang === 'ru') ? s : (K.EN[s] || s);
    if (p) { r = r.replace(/\{(\w+)\}/g, function (m, k) { return p[k] != null ? p[k] : m; }); }
    return r;
  };
  window.t = K.t;
})();
