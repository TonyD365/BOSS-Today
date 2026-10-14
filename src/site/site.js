// Small enhancements for the static public site: today's date, the banner's
// expiry, the theme switch, sharing and search.
;(function () {
  var today = new Intl.DateTimeFormat('en-CA', { dateStyle: 'full' }).format(new Date())
  document.querySelectorAll('[data-today]').forEach(function (el) {
    el.textContent = today
  })

  // The banner hides itself when it expires, so no rebuild is needed to take it down.
  document.querySelectorAll('[data-expires]').forEach(function (el) {
    var expires = new Date(el.getAttribute('data-expires')).getTime()
    var hide = function () {
      el.hidden = true
    }
    var left = expires - Date.now()
    if (!(left > 0)) hide()
    else if (left < 2147483647) setTimeout(hide, left)
  })

  // Theme: follow the device, or the reader's own choice.
  var root = document.documentElement
  var store = function (value) {
    try {
      if (value) localStorage.setItem('theme', value)
      else localStorage.removeItem('theme')
    } catch (_e) {}
  }
  var themeLabels = { '': 'Theme: auto', dark: 'Theme: dark', light: 'Theme: light' }
  var themeOrder = ['', 'dark', 'light']
  var dateBox = document.querySelector('.site-header__date')
  if (dateBox) {
    var toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'theme-toggle'
    var current = function () {
      return root.dataset.theme || ''
    }
    var label = function () {
      toggle.textContent = themeLabels[current()]
      toggle.setAttribute('aria-label', themeLabels[current()] + '. Click to change.')
    }
    toggle.addEventListener('click', function () {
      var next = themeOrder[(themeOrder.indexOf(current()) + 1) % themeOrder.length]
      if (next) root.dataset.theme = next
      else delete root.dataset.theme
      store(next)
      label()
    })
    label()
    dateBox.appendChild(toggle)
  }

  // Sharing: the phone's own share sheet where there is one, and copying the link.
  var nativeShare = document.querySelector('[data-share-native]')
  if (nativeShare && navigator.share) {
    nativeShare.hidden = false
    nativeShare.addEventListener('click', function () {
      navigator.share({ title: document.title, url: window.location.href }).catch(function () {})
    })
  }
  var copy = document.querySelector('[data-share-copy]')
  if (copy && navigator.clipboard) {
    copy.hidden = false
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(copy.getAttribute('data-share-copy')).then(function () {
        copy.textContent = 'Link copied'
        setTimeout(function () {
          copy.textContent = 'Copy link'
        }, 2000)
      })
    })
  }

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
          var text = (
            item.t +
            ' ' +
            item.s +
            ' ' +
            item.a +
            ' ' +
            item.c +
            ' ' +
            (item.g || '')
          ).toLowerCase()
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
