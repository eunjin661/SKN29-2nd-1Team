import { lazy, Suspense } from 'react'
import LoadingState from './components/LoadingState'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import Navbar from './components/Navbar'
import AnimatedPage from './components/layout/AnimatedPage'
import ApiStatusBanner from './components/ApiStatusBanner'
import { useDarkMode } from './hooks/useDarkMode'
import { useApiHealth } from './hooks/useApiHealth'

import './App.css'
import './styles/ChartRenderFix.css'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const TrendingPage = lazy(() => import('./pages/TrendingPage'))
const VideoPage = lazy(() => import('./pages/VideoPage'))
const SustainPage = lazy(() => import('./pages/SustainPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CampaignPlannerPage = lazy(() => import('./pages/CampaignPlannerPage'))

const ROUTES = [
  { path: '/', key: 'home', Component: LandingPage },
  { path: '/analysis/*', key: 'analysis', Component: TrendingPage },
  { path: '/video', key: 'video', Component: VideoPage },
  { path: '/sustain', key: 'sustain', Component: SustainPage },
  { path: '/campaign', key: 'campaign', Component: CampaignPlannerPage },
  { path: '/dashboard', key: 'dashboard', Component: DashboardPage },
]

export default function App() {
  const [darkMode, setDarkMode] = useDarkMode()
  const apiOnline = useApiHealth()

  return (
    <BrowserRouter>
      <div className={`yta-root ${darkMode ? 'dark' : ''}`}>
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
        {!apiOnline && <ApiStatusBanner />}

        <Suspense fallback={<LoadingState title="화면을 불러오는 중" message="선택한 화면을 준비하고 있습니다." />}>
        <AnimatePresence mode="wait">
          <Routes>
            {ROUTES.map(({ path, key, Component }) => (
              <Route
                key={key}
                path={path}
                element={(
                  <AnimatedPage pageKey={key}>
                    <Component />
                  </AnimatedPage>
                )}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}
