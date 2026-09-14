/* HuB on Lewis — site interactions */

const BOOK_URL = 'https://the-hub-qy8a.onrender.com/book'
const WAITLIST_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScqZ8FeGHHTK_CODaiU-bLAovGN6cQ8HSSgiSRqFGK2GL-trQ/viewform?usp=header'
const EMAIL = 'info@hubonlewis.com'

const yearEl = document.getElementById('year')
if (yearEl) yearEl.textContent = String(new Date().getFullYear())

/* Sticky header state */
const header = document.getElementById('site-header')
const onScroll = () => {
  if (!header) return
  header.classList.toggle('is-scrolled', window.scrollY > 12)
}
onScroll()
window.addEventListener('scroll', onScroll, { passive: true })

/* Mobile nav */
const toggle = document.getElementById('nav-toggle')
const nav = document.getElementById('primary-nav')
const setNav = (open) => {
  if (!nav || !toggle) return
  nav.classList.toggle('is-open', open)
  toggle.setAttribute('aria-expanded', String(open))
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  document.body.classList.toggle('nav-open', open)
}
toggle?.addEventListener('click', () => {
  setNav(!nav.classList.contains('is-open'))
})
nav?.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => setNav(false))
})

/* Active section highlight */
const sectionIds = [
  'home',
  'gatherings',
  'space',
  'amenities',
  'booking',
  'gallery',
  'offices',
  'location',
  'faq',
  'contact',
]
const navLinks = [...(nav?.querySelectorAll('a[href^="#"]') || [])]
const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean)

const setActive = () => {
  const y = window.scrollY + 110
  let current = sections[0]?.id
  for (const s of sections) {
    if (s.offsetTop <= y) current = s.id
  }
  navLinks.forEach((link) => {
    const href = link.getAttribute('href')?.slice(1)
    link.toggleAttribute('aria-current', href === current)
  })
}
window.addEventListener('scroll', setActive, { passive: true })
setActive()

/* Reveal on scroll */
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (!prefersReduced && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  )
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
} else {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'))
}

/* Lightbox */
const lightbox = document.getElementById('lightbox')
const lightboxImg = document.getElementById('lightbox-img')
const lightboxClose = document.getElementById('lightbox-close')
let lastFocus = null

const openLightbox = (src, alt) => {
  if (!lightbox || !lightboxImg) return
  lastFocus = document.activeElement
  lightboxImg.src = src
  lightboxImg.alt = alt || ''
  lightbox.hidden = false
  requestAnimationFrame(() => lightbox.classList.add('is-open'))
  lightboxClose?.focus()
  document.body.style.overflow = 'hidden'
}

const closeLightbox = () => {
  if (!lightbox) return
  lightbox.classList.remove('is-open')
  document.body.style.overflow = ''
  setTimeout(() => {
    lightbox.hidden = true
    lightboxImg.src = ''
    lastFocus?.focus()
  }, 250)
}

document.getElementById('gallery-grid')?.addEventListener('click', (e) => {
  const item = e.target.closest('.gallery-item')
  if (!item) return
  const img = item.querySelector('img')
  openLightbox(item.dataset.full || img?.src, img?.alt)
})

lightboxClose?.addEventListener('click', closeLightbox)
lightbox?.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lightbox?.classList.contains('is-open')) closeLightbox()
})

/* Inquiry form → mailto + success UI */
const form = document.getElementById('inquiry-form')
const success = document.getElementById('form-success')
const resetBtn = document.getElementById('form-reset')

form?.addEventListener('submit', (e) => {
  e.preventDefault()
  const data = new FormData(form)
  const name = String(data.get('name') || '').trim()
  const email = String(data.get('email') || '').trim()
  const interest = String(data.get('interest') || '').trim()
  const message = String(data.get('message') || '').trim()

  if (!name || !email || !message) {
    form.reportValidity()
    return
  }

  const subject = encodeURIComponent(`HuB on Lewis inquiry — ${interest}`)
  const body = encodeURIComponent(
    `Name: ${name}\nEmail: ${email}\nInterest: ${interest}\n\n${message}`
  )
  window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`

  form.classList.add('is-hidden')
  form.hidden = true
  if (success) {
    success.hidden = false
    success.classList.add('is-visible')
  }
})

resetBtn?.addEventListener('click', () => {
  form?.reset()
  form?.classList.remove('is-hidden')
  if (form) form.hidden = false
  if (success) {
    success.classList.remove('is-visible')
    success.hidden = true
  }
})

/* FAQ accordion */
document.querySelectorAll('.faq-item').forEach((item) => {
  const btn = item.querySelector('.faq-q')
  const panel = item.querySelector('.faq-a')
  if (!btn || !panel) return
  btn.addEventListener('click', () => {
    const open = item.classList.toggle('is-open')
    btn.setAttribute('aria-expanded', String(open))
    panel.hidden = !open
  })
})

window.HUB = { BOOK_URL, WAITLIST_URL, EMAIL }
