// Small enhancements for the static public site: today's date, the banner's
// expiry, the theme switch, sharing and search.
;(function () {
  var today = new Intl.DateTimeFormat('en-CA', { dateStyle: 'full' }).format(new Date())
  document.querySelectorAll('[data-today]').forEach(function (el) {
    el.textContent = today
  })

  // The banner and Most read come from Cloudflare KV through /api/live
  // (functions/api/live.js), not from the built pages, so they change without a
  // rebuild. The banner hides itself when it expires.
  var bannerBox = document.getElementById('site-banner')
  var mostRead = document.getElementById('most-read')
  var showBanner = function (banner) {
    if (!bannerBox || !banner || !banner.text) return
    var left = banner.expiresAt ? new Date(banner.expiresAt).getTime() - Date.now() : Infinity
    if (!(left > 0)) return
    bannerBox.className =
      'site-banner site-banner--' + (banner.style === 'urgent' ? 'urgent' : 'info')
    bannerBox.setAttribute('role', 'status')
    var holder = bannerBox
    if (banner.link && /^(https?:\/\/|\/)/.test(banner.link)) {
      holder = document.createElement('a')
      holder.href = banner.link
      bannerBox.appendChild(holder)
    }
    holder.textContent = banner.text
    bannerBox.hidden = false
    if (left < 2147483647) {
      setTimeout(function () {
        bannerBox.hidden = true
      }, left)
    }
  }
  var showMostRead = function (stories) {
    if (!mostRead || !Array.isArray(stories) || stories.length === 0) return
    var list = mostRead.querySelector('ol')
    stories.slice(0, 5).forEach(function (story) {
      if (!story || !story.title || !/^\/article\//.test(story.url || '')) return
      var item = document.createElement('li')
      if (story.section) {
        var kicker = document.createElement('span')
        kicker.className = 'kicker'
        kicker.textContent = story.section
        item.appendChild(kicker)
      }
      var link = document.createElement('a')
      link.href = story.url
      link.textContent = story.title
      item.appendChild(link)
      list.appendChild(item)
    })
    if (list.children.length > 0) mostRead.hidden = false
  }
  if ((bannerBox || mostRead) && window.fetch) {
    fetch('/api/live')
      .then(function (response) {
        return response.ok ? response.json() : null
      })
      .then(function (live) {
        if (!live) return
        showBanner(live.banner)
        showMostRead(live.mostRead)
      })
      .catch(function () {})
  }

  // Contact form: posts to the newsroom as plain text, so no extra request is needed first.
  var form = document.querySelector('.contact__form')
  if (form) {
    var params = new URLSearchParams(window.location.search)
    var type = params.get('type')
    var article = params.get('article') || ''
    if (['letter', 'tip', 'correction'].indexOf(type) !== -1) {
      var choice = form.querySelector('input[name="kind"][value="' + type + '"]')
      if (choice) choice.checked = true
    }
    var about = form.querySelector('.contact__about')
    if (article && about) {
      about.textContent = 'About the story: /article/' + article + '/'
      about.hidden = false
    }
    var body = form.querySelector('textarea[name="body"]')
    var count = form.querySelector('.contact__count')
    var status = form.querySelector('.contact__status')
    var button = form.querySelector('button[type="submit"]')
    body.addEventListener('input', function () {
      count.textContent = body.value.length + ' / 3000'
    })
    form.addEventListener('submit', function (event) {
      event.preventDefault()
      var data = new FormData(form)
      var kind = form.querySelector('input[name="kind"]:checked')
      status.className = 'contact__status'
      status.textContent = 'Sending…'
      button.disabled = true
      fetch(form.getAttribute('data-endpoint'), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          kind: kind ? kind.value : '',
          body: data.get('body'),
          name: data.get('name'),
          email: data.get('email'),
          affiliation: data.get('affiliation'),
          website: data.get('website'),
          consent: form.querySelector('input[name="consent"]').checked,
          article: article,
          token: data.get('cf-turnstile-response') || '',
        }),
      })
        .then(function (response) {
          return response.json().then(function (result) {
            return { ok: response.ok, result: result }
          })
        })
        .then(function (reply) {
          if (reply.ok) {
            form.reset()
            count.textContent = '0 / 3000'
            status.className = 'contact__status contact__status--ok'
            status.textContent =
              'Thank you. Your message reached the newsroom. If we plan to publish it, an editor will email you first.'
          } else {
            status.className = 'contact__status contact__status--error'
            status.textContent = reply.result.message || 'Something went wrong. Please try again.'
          }
        })
        .catch(function () {
          status.className = 'contact__status contact__status--error'
          status.textContent =
            'We couldn’t reach the newsroom. Check your connection and try again.'
        })
        .then(function () {
          button.disabled = false
          if (window.turnstile) window.turnstile.reset()
        })
    })
  }

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
