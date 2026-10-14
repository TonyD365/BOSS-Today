// Small enhancements for the static public site: today's date and search.
;(function () {
  var today = new Intl.DateTimeFormat('en-CA', { dateStyle: 'full' }).format(new Date())
  document.querySelectorAll('[data-today]').forEach(function (el) {
    el.textContent = today
  })

  var results = document.getElementById('search-results')
  if (!results) return
  var query = new URLSearchParams(window.location.search).get('q') || ''
  var input = document.getElementById('search-page-input')
  if (input) input.value = query
  var terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return

  var escape = function (value) {
    return String(value || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  results.innerHTML = '<p class="listing__empty">Searching…</p>'
  fetch('/search-index.json')
    .then(function (response) {
      return response.json()
    })
    .then(function (items) {
      var matches = items
        .filter(function (item) {
          var text = (item.t + ' ' + item.s + ' ' + item.a + ' ' + item.c).toLowerCase()
          return terms.every(function (term) {
            return text.indexOf(term) !== -1
          })
        })
        .slice(0, 50)
      if (matches.length === 0) {
        results.innerHTML =
          '<p class="listing__empty">No stories match “' + escape(query) + '”.</p>'
        return
      }
      results.innerHTML = matches
        .map(function (item) {
          return (
            '<article class="story story--row"><div class="story__text">' +
            (item.c ? '<span class="kicker">' + escape(item.c) + '</span>' : '') +
            '<h3 class="story__headline"><a href="/article/' +
            encodeURIComponent(item.u) +
            '/">' +
            escape(item.t) +
            '</a></h3>' +
            '<p class="story__summary">' +
            escape(item.s) +
            '</p>' +
            '<p class="story__meta">' +
            (item.a ? '<span class="byline">By ' + escape(item.a) + '</span>' : '') +
            '<time>' +
            escape(item.d) +
            '</time></p></div></article>'
          )
        })
        .join('')
    })
    .catch(function () {
      results.innerHTML = '<p class="listing__empty">Search is unavailable right now.</p>'
    })
})()
