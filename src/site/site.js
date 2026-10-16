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
  // Scores, the calendar and live coverage (src/publishing/board.ts).
  var zone = 'America/Toronto'
  var fmt = function (options) {
    return new Intl.DateTimeFormat('en-CA', Object.assign({ timeZone: zone }, options))
  }
  var whenShort = fmt({
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  var dayLong = fmt({ weekday: 'long', month: 'long', day: 'numeric' })
  var timeOnly = fmt({ hour: 'numeric', minute: '2-digit' })
  var dayKey = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' })
  var el = function (tag, className, text) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined && text !== null) node.textContent = text
    return node
  }
  var safeLink = function (href) {
    return typeof href === 'string' && /^(https?:\/\/|\/)/.test(href) ? href : null
  }
  var gameLine = function (game) {
    var item = el('li', 'game game--' + game.status)
    item.appendChild(el('span', 'game__team', game.team))
    var vs = (game.home ? 'vs ' : 'at ') + game.opponent
    var result
    if (game.status === 'final' || game.status === 'live') {
      var ours = game.ourScore === null ? 0 : game.ourScore
      var theirs = game.theirScore === null ? 0 : game.theirScore
      var outcome =
        game.status === 'live' ? 'LIVE' : ours > theirs ? 'W' : ours < theirs ? 'L' : 'T'
      result = outcome + ' ' + ours + '–' + theirs + ' ' + vs + (game.note ? ' · ' + game.note : '')
    } else if (game.status === 'cancelled') {
      result = vs + ' · postponed or cancelled'
    } else {
      result =
        vs +
        ' · ' +
        whenShort.format(new Date(game.startsAt)) +
        (game.location ? ' · ' + game.location : '')
    }
    var line = el('span', 'game__result', result)
    var recap = safeLink(game.recap)
    if (recap) {
      var link = el('a', 'game__recap', 'Recap')
      link.href = recap
      line.appendChild(document.createTextNode(' · '))
      line.appendChild(link)
    }
    item.appendChild(line)
    return item
  }
  var eventLine = function (event, underDayHeading) {
    var item = el('li', 'event')
    var start = new Date(event.startsAt)
    // Under a day's heading the date is already shown; all-day events need no time.
    var when = underDayHeading
      ? event.allDay
        ? null
        : timeOnly.format(start)
      : event.allDay
        ? dayLong.format(start)
        : whenShort.format(start)
    if (when) item.appendChild(el('span', 'event__when', when))
    var href = safeLink(event.link)
    var title = el(href ? 'a' : 'span', 'event__title', event.title)
    if (href) title.href = href
    item.appendChild(title)
    if (event.location) item.appendChild(el('span', 'event__where', event.location))
    return item
  }
  var byStart = function (a, b) {
    return new Date(a.startsAt) - new Date(b.startsAt)
  }
  var fill = function (box, items, render) {
    if (!box) return
    var list = box.querySelector('ul')
    list.textContent = ''
    items.forEach(function (item) {
      list.appendChild(render(item))
    })
    box.hidden = items.length === 0
  }

  var showBoard = function (board) {
    if (!board) return
    var now = Date.now()
    var games = board.games || []
    var events = board.events || []
    var live = (board.live || []).filter(function (item) {
      return item.status === 'live'
    })

    var strip = document.getElementById('live-strip')
    if (strip) {
      strip.textContent = ''
      live.forEach(function (item) {
        var link = el('a', null)
        link.href = '/live/?s=' + encodeURIComponent(item.slug)
        link.appendChild(el('span', 'live-badge', 'LIVE'))
        link.appendChild(document.createTextNode(' ' + item.title))
        strip.appendChild(link)
      })
      strip.hidden = live.length === 0
    }

    var playing = games.filter(function (g) {
      return g.status === 'live'
    })
    var finals = games
      .filter(function (g) {
        return g.status === 'final'
      })
      .sort(byStart)
      .reverse()
    var upcoming = games
      .filter(function (g) {
        return g.status === 'scheduled' && new Date(g.startsAt) > now - 3 * 3600000
      })
      .sort(byStart)
    fill(
      document.getElementById('scores-box'),
      playing.concat(finals.slice(0, 3), upcoming.slice(0, 3)).slice(0, 6),
      gameLine,
    )

    var week = events
      .filter(function (e) {
        var start = new Date(e.startsAt).getTime()
        var end = e.endsAt ? new Date(e.endsAt).getTime() : start + 3600000
        return end >= now && start <= now + 7 * 86400000
      })
      .sort(byStart)
    fill(document.getElementById('events-box'), week.slice(0, 5), eventLine)

    var scoresPage = document.getElementById('scores-page')
    if (scoresPage) {
      scoresPage.textContent = ''
      var groups = [
        ['Live now', playing],
        ['Upcoming', upcoming],
        ['Results', finals],
        [
          'Postponed or cancelled',
          games.filter(function (g) {
            return g.status === 'cancelled'
          }),
        ],
      ]
      groups.forEach(function (group) {
        if (group[1].length === 0) return
        scoresPage.appendChild(el('h2', 'section-block__title', group[0]))
        var list = el('ul', 'board-list')
        group[1].forEach(function (game) {
          list.appendChild(gameLine(game))
        })
        scoresPage.appendChild(list)
      })
      if (!scoresPage.firstChild)
        scoresPage.appendChild(el('p', 'listing__empty', 'No games in the next few weeks.'))
    }

    var calendarPage = document.getElementById('calendar-page')
    if (calendarPage) {
      calendarPage.textContent = ''
      var current = null
      var list = null
      events
        .filter(function (e) {
          return new Date(e.endsAt || e.startsAt).getTime() >= now - 3600000
        })
        .sort(byStart)
        .forEach(function (event) {
          var key = dayKey.format(new Date(event.startsAt))
          if (key !== current) {
            current = key
            calendarPage.appendChild(
              el('h2', 'section-block__title', dayLong.format(new Date(event.startsAt))),
            )
            list = el('ul', 'board-list')
            calendarPage.appendChild(list)
          }
          var item = eventLine(event, true)
          if (event.description) item.appendChild(el('p', 'event__about', event.description))
          list.appendChild(item)
        })
      if (!calendarPage.firstChild)
        calendarPage.appendChild(el('p', 'listing__empty', 'Nothing on the calendar yet.'))
    }

    var livePage = document.getElementById('live-page')
    if (livePage && !new URLSearchParams(window.location.search).get('s')) {
      livePage.textContent = ''
      var all = board.live || []
      if (all.length === 0)
        livePage.appendChild(el('p', 'listing__empty', 'No live coverage right now.'))
      var index = el('ul', 'board-list')
      all.forEach(function (item) {
        var row = el('li', 'event')
        if (item.status === 'live') row.appendChild(el('span', 'live-badge', 'LIVE'))
        var link = el('a', 'event__title', item.title)
        link.href = '/live/?s=' + encodeURIComponent(item.slug)
        row.appendChild(link)
        index.appendChild(row)
      })
      livePage.appendChild(index)
    }
    return playing.length > 0
  }

  var bannerShown = false
  var mostReadShown = false
  var loadLive = function () {
    return fetch('/api/live')
      .then(function (response) {
        return response.ok ? response.json() : null
      })
      .then(function (live) {
        if (!live) return false
        if (!bannerShown) {
          bannerShown = true
          showBanner(live.banner)
        }
        if (!mostReadShown) {
          mostReadShown = true
          showMostRead(live.mostRead)
        }
        return showBoard(live.board)
      })
      .catch(function () {
        return false
      })
  }
  var wantsLive =
    bannerBox ||
    mostRead ||
    document.getElementById('scores-page') ||
    document.getElementById('calendar-page') ||
    document.getElementById('live-page')
  if (wantsLive && window.fetch) {
    var poll = function () {
      loadLive().then(function (anyLive) {
        // Keep live scores fresh while a game is on.
        var showsScores =
          document.getElementById('scores-box') || document.getElementById('scores-page')
        if (anyLive && showsScores) setTimeout(poll, 60000)
      })
    }
    poll()
  }

  // One live coverage page: /live/?s=slug, refreshed every 30 seconds while live.
  var livePageBox = document.getElementById('live-page')
  var slug = new URLSearchParams(window.location.search).get('s')
  if (livePageBox && slug && window.fetch) {
    var titleBox = document.querySelector('[data-live-title]')
    var introBox = document.querySelector('[data-live-intro]')
    var drawBlog = function (blog) {
      if (!blog || !blog.title) {
        livePageBox.textContent = ''
        livePageBox.appendChild(el('p', 'listing__empty', 'This live coverage isn’t available.'))
        return false
      }
      document.title = blog.title + ' — Live'
      titleBox.textContent = blog.title
      introBox.textContent = blog.summary || ''
      if (blog.status === 'live')
        introBox.insertBefore(el('span', 'live-badge', 'LIVE'), introBox.firstChild)
      livePageBox.textContent = ''
      var list = el('ol', 'live-updates')
      ;(blog.updates || []).forEach(function (update) {
        var item = el('li', 'live-update')
        if (update.at) {
          var time = el('time', 'live-update__time', timeOnly.format(new Date(update.at)))
          time.setAttribute('datetime', update.at)
          time.title = dayLong.format(new Date(update.at))
          item.appendChild(time)
        }
        var body = el('div', 'live-update__body')
        String(update.text || '')
          .split(/\n+/)
          .forEach(function (paragraph) {
            if (paragraph.trim()) body.appendChild(el('p', null, paragraph))
          })
        if (update.image && update.image.url) {
          var picture = el('img', 'live-update__image')
          var size = update.image.sizes && update.image.sizes.card
          picture.src = (size && size.url) || update.image.url
          picture.alt = update.image.alt || ''
          picture.loading = 'lazy'
          body.appendChild(picture)
        }
        item.appendChild(body)
        list.appendChild(item)
      })
      if (!list.firstChild)
        livePageBox.appendChild(
          el('p', 'listing__empty', 'No updates yet. This page refreshes by itself.'),
        )
      livePageBox.appendChild(list)
      return blog.status === 'live'
    }
    var pollBlog = function () {
      fetch('/api/live?blog=' + encodeURIComponent(slug.toLowerCase()))
        .then(function (response) {
          return response.ok ? response.json() : {}
        })
        .then(function (result) {
          if (drawBlog(result.blog)) setTimeout(pollBlog, 30000)
        })
        .catch(function () {
          setTimeout(pollBlog, 60000)
        })
    }
    pollBlog()
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
