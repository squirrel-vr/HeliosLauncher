// scale everything from the 1920x1080 figma frame
(function () {
    const root = document.documentElement
    let frame = 0

    function apply() {
        frame = 0
        const s = Math.min(root.clientWidth / 1920, root.clientHeight / 1080)
        root.style.setProperty('--s', String(Math.round(s * 10000) / 10000))
    }

    apply()
    new ResizeObserver(() => { frame ||= requestAnimationFrame(apply) }).observe(root)
})()

// same easing for jquery animations
;(function () {
    const MOTION = { fast: 180, base: 280, slow: 420 }

    function bezier(x1, y1, x2, y2) {
        const at = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
        return x => {
            if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1
            let lo = 0, hi = 1, t = x
            for (let i = 0; i < 20; i++) {
                if (at(t, x1, x2) < x) lo = t; else hi = t
                t = (lo + hi) / 2
            }
            return at(t, y1, y2)
        }
    }

    const snap = d => typeof d !== 'number' ? d : d <= 0 ? 0 : d <= 200 ? MOTION.fast : d <= 350 ? MOTION.base : MOTION.slow

    $.easing.easeOutSoft = bezier(0.22, 0.61, 0.36, 1)
    $.easing.easeInOutSoft = bezier(0.45, 0.05, 0.25, 1)
    $.easing.swing = $.easing.easeInOutSoft
    $.easing.linear = $.easing.easeInOutSoft
    $.fx.speeds._default = MOTION.base
    $.fx.speeds.fast = MOTION.fast
    $.fx.speeds.slow = MOTION.slow

    for (const name of ['fadeIn', 'fadeOut', 'fadeToggle', 'fadeTo', 'slideUp', 'slideDown', 'slideToggle']) {
        const orig = $.fn[name]
        $.fn[name] = function (duration, ...rest) { return orig.call(this, snap(duration), ...rest) }
    }
    const animate = $.fn.animate
    $.fn.animate = function (props, duration, ...rest) { return animate.call(this, props, snap(duration), ...rest) }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const applyReduced = () => { $.fx.off = reduced.matches }
    applyReduced()
    reduced.addEventListener('change', applyReduced)
})()

// keep the logo screen until my favorite fonts are loaded
const Startup = (() => {
    const MIN_VISIBLE_MS = 900
    const shownAt = performance.now()
    const fontsReady = Promise.all(
        [300, 400, 500].map(w => document.fonts.load(`${w} 36px "e-Ukraine"`, 'Грати ЇїЄєҐґ VRUkraine 0123%'))
    ).catch(() => {})
    let dismissed = false

    function dismiss() {
        if (dismissed) return Promise.resolve()
        dismissed = true
        const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt))
        return Promise.all([fontsReady, new Promise(r => setTimeout(r, wait))]).then(() => {
            const el = document.getElementById('loadingContainer')
            el.classList.add('is-done')
            setTimeout(() => { el.style.display = 'none' }, 800)
        })
    }

    return { dismiss }
})()

const AppBackground = (() => {
    const fs = require('fs')
    const path = require('path')
    const { pathToFileURL } = require('url')
    const got = require('got')
    const { REMOTE_BACKGROUND_IMAGES_URL } = require('./assets/js/ipcconstants')

    const DIR = path.join(__dirname, 'assets', 'images', 'backgrounds')
    const BLUR = { auth: 10, panel: 5 }
    const RENDER_SCALE = 0.5

    const root = () => document.getElementById('appBackground')
    const pick = list => list[Math.floor(Math.random() * list.length)]
    let picture = null
    let resizeTimer = 0

    function localPictures() {
        try {
            return fs.readdirSync(DIR)
                .filter(f => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('.'))
                .map(f => pathToFileURL(path.join(DIR, f)).href)
        } catch {
            return []
        }
    }

    async function remotePictures() {
        if (!REMOTE_BACKGROUND_IMAGES_URL) return []
        try {
            const text = await got(REMOTE_BACKGROUND_IMAGES_URL, { timeout: 4000, retry: 0 }).text()
            return text.split('|||').map(u => u.trim()).filter(u => /^https?:\/\//i.test(u))
        } catch {
            return []
        }
    }

    async function loadImage(url) {
        const img = new Image()
        img.src = url
        await img.decode()
        return img
    }

    // try the server list first, then local backgounds
    async function load() {
        const candidates = [pick(await remotePictures()), pick(localPictures())].filter(Boolean)
        for (const url of candidates) {
            try {
                return show(await loadImage(url))
            } catch (err) {
                console.warn('[Background] Could not load', url, err.message)
            }
        }
    }

    async function setPicture(url) {
        show(await loadImage(url))
    }

    function show(img) {
        picture = img
        const el = root().querySelector('.bg__image')
        el.src = img.src
        renderBlurLayers()
        el.classList.add('is-loaded')
    }

    function scale() {
        return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1
    }

    function drawCover(ctx, w, h) {
        const k = Math.max(w / picture.naturalWidth, h / picture.naturalHeight)
        const dw = picture.naturalWidth * k
        const dh = picture.naturalHeight * k
        ctx.drawImage(picture, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }

    function blurred(w, h, radius) {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        drawCover(ctx, w, h)
        ctx.filter = `blur(${radius * scale() * RENDER_SCALE}px)`
        drawCover(ctx, w, h)
        return c
    }

    function paint(target, source, sy, sh) {
        target.width = source.width
        target.height = Math.max(1, Math.round(sh))
        target.getContext('2d').drawImage(source, 0, sy, source.width, sh, 0, 0, source.width, sh)
    }

    // blur is drawn once, not every frame (I'm fast as fuck boi)
    function renderBlurLayers() {
        if (!picture) return
        const w = Math.max(1, Math.round(innerWidth * RENDER_SCALE))
        const h = Math.max(1, Math.round(innerHeight * RENDER_SCALE))
        const sources = { auth: blurred(w, h, BLUR.auth), panel: blurred(w, h, BLUR.panel) }

        document.querySelectorAll('canvas[data-blur]').forEach(c => {
            const [kind, edge] = c.dataset.blur.split('-')
            const sh = edge ? Math.min(h, c.dataset.designH * scale() * RENDER_SCALE) : h
            paint(c, sources[kind], edge === 'bottom' ? h - sh : 0, sh)
        })
    }

    function setForView(view) {
        root().dataset.treatment = view === '#landingContainer' ? 'main' : 'auth'
    }

    function setNewsOpen(open) {
        root().dataset.news = open ? 'open' : 'closed'
    }

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(renderBlurLayers, 150)
    })
    document.addEventListener('DOMContentLoaded', load, { once: true })

    return { setPicture, setForView, setNewsOpen }
})()
