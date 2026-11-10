// Hamburger menu toggle.
(function () {
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  function setOpen(open) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  btn.addEventListener('click', function () {
    setOpen(!nav.classList.contains('open'));
  });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); btn.focus(); }
  });
})();

// Site search: loads every page once, then searches their text in the browser.
(function () {
  var form = document.querySelector('.site-search');
  var input = document.getElementById('site-search-input');
  var list = document.getElementById('search-results');
  if (!form || !input || !list) return;

  var PAGES = [
    'index.html', 'about.html', 'projects.html', 'career.html', 'beyond.html', 'resume.html',
    'project-fir-filter.html', 'project-risc-v-cpu.html', 'project-programmable-spi.html',
    'project-haptic-headband.html'
  ];
  var index = null, loading = null, results = [], active = -1;

  function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

  function load() {
    if (loading) return loading;
    loading = Promise.all(PAGES.map(function (url) {
      return fetch(url).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
        if (!html) return null;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var main = doc.querySelector('main');
        if (!main) return null;
        main.querySelectorAll('script, style, .slot-label').forEach(function (n) { n.remove(); });
        var title = url === 'index.html' ? 'Home' : (clean(doc.title.replace(/\s*·\s*Ryan Karami$/, '')) || url);
        var heads = Array.prototype.map.call(main.querySelectorAll('h2, h3'), function (h) { return clean(h.textContent); }).join(' ');
        return { url: url, title: title, heads: heads, text: clean(main.textContent) };
      }).catch(function () { return null; });
    })).then(function (pages) { index = pages.filter(function (p) { return p && (p.text || p.title); }); });
    return loading;
  }

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function highlight(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) { out = out.replace(new RegExp('(' + reEsc(esc(t)) + ')', 'gi'), '<mark>$1</mark>'); });
    return out;
  }

  function snippet(text, terms) {
    var low = text.toLowerCase(), pos = -1;
    terms.forEach(function (t) { var i = low.indexOf(t); if (i !== -1 && (pos === -1 || i < pos)) pos = i; });
    if (pos === -1) return text.slice(0, 140) + (text.length > 140 ? '…' : '');
    var start = Math.max(0, pos - 60), end = Math.min(text.length, pos + 100);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return index.map(function (p) {
      var title = p.title.toLowerCase(), heads = p.heads.toLowerCase(), text = p.text.toLowerCase(), score = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i];
        if (title.indexOf(t) === -1 && text.indexOf(t) === -1) return null;
        if (title.indexOf(t) !== -1) score += 10;
        if (heads.indexOf(t) !== -1) score += 4;
        score += Math.min(text.split(t).length - 1, 10);
      }
      return { page: p, score: score, terms: terms };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 8);
  }

  function render(q) {
    results = search(q);
    active = -1;
    if (!results.length) {
      list.innerHTML = '<li class="sr-empty">No results for “' + esc(q) + '”</li>';
    } else {
      list.innerHTML = results.map(function (r, i) {
        var frag = '#:~:text=' + encodeURIComponent(r.terms[0]);
        return '<li role="option" id="sr-' + i + '" aria-selected="false"><a href="' + r.page.url + frag + '">' +
          '<span class="sr-title">' + highlight(r.page.title, r.terms) + '</span>' +
          '<span class="sr-snip">' + highlight(snippet(r.page.text, r.terms), r.terms) + '</span></a></li>';
      }).join('');
    }
    list.hidden = false;
  }

  function setActive(i) {
    var items = list.querySelectorAll('li[role="option"]');
    if (!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach(function (li, j) { li.setAttribute('aria-selected', j === active ? 'true' : 'false'); });
    items[active].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', 'sr-' + active);
  }

  function close() { list.hidden = true; active = -1; input.removeAttribute('aria-activedescendant'); }

  function update() {
    var q = input.value.trim();
    if (!q) { close(); return; }
    if (index) render(q);
    else {
      list.innerHTML = '<li class="sr-empty">Searching…</li>';
      list.hidden = false;
      load().then(function () { if (input.value.trim()) render(input.value.trim()); });
    }
  }

  input.addEventListener('focus', function () {
    var nav = document.getElementById('site-nav'), mb = document.querySelector('.menu-btn');
    if (nav && nav.classList.contains('open')) { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); }
    load(); if (input.value.trim()) update(); });
  input.addEventListener('input', update);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Escape') { close(); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var link = list.querySelectorAll('li[role="option"] a')[active > -1 ? active : 0];
    if (link) window.location.href = link.getAttribute('href');
  });
  document.addEventListener('click', function (e) { if (!form.contains(e.target)) close(); });
})();
