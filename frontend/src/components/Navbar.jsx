import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import trenditMark from '../assets/trendit-mark.svg'
import MobileNavigation from './navigation/MobileNavigation'
import { NAV_ITEMS, isActiveRoute } from '../constants/navigation'

function NavigationBar({ darkMode, setDarkMode, pathname }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(() => Math.max(window.scrollY, document.body.scrollTop) > 14)

  const moveTo = (path) => {
    navigate(path)
    setMenuOpen(false)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(Math.max(window.scrollY, document.body.scrollTop) > 14)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const onResize = () => {
      if (window.innerWidth > 900) setMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <nav className={`yta-nav ${scrolled ? 'is-scrolled' : ''}`} aria-label="주요 메뉴">
      <div className="yta-nav-left">
        <button className="yta-nav-logo" onClick={() => moveTo('/')} aria-label="TrendIt 홈으로 이동">
          <img className="yta-logo-mark" src={trenditMark} alt="" aria-hidden="true" />
          <span className="yta-logo-word" aria-label="TrendIt">
            Trend<span>It</span>
          </span>
        </button>

        <div className="yta-nav-links">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`yta-nav-btn ${isActiveRoute(pathname, item) ? 'active' : ''}`}
              onClick={() => moveTo(item.path)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="yta-nav-right">
        <button
          className="yta-icon-btn"
          type="button"
          onClick={() => setDarkMode((d) => !d)}
          aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {darkMode
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        </button>
        <button
          type="button"
          className={`yta-menu-btn ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? '모바일 메뉴 닫기' : '모바일 메뉴 열기'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <MobileNavigation
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={moveTo}
        pathname={pathname}
      />
    </nav>
  )
}

export default function Navbar(props) {
  const location = useLocation()
  // A navigation creates a fresh menu state, including browser Back/Forward.
  return <NavigationBar key={location.key} {...props} pathname={location.pathname} />
}
