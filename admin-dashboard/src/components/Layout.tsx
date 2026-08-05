import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Button } from './Ui';

// Bottom-tab items, styled with the published blue / red / green gradients so
// the admin console mirrors the app's navigation.
const NAV_ITEMS: Array<{ to: string; label: string; end?: boolean; icon: string }> = [
  { to: '/', label: 'Overview', end: true, icon: '◆' },
  { to: '/vendors', label: 'Vendors', icon: '▲' },
  { to: '/marketing', label: 'Marketing', icon: '✉' },
  { to: '/cards', label: 'Cards', icon: '❖' },
  { to: '/tickets', label: 'Tickets', icon: '🎫' },
  { to: '/events', label: 'Events', icon: '★' },
  { to: '/content', label: 'Content', icon: '✎' },
  { to: '/theme', label: 'Theme', icon: '✿' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function AppLayout() {
  const { profile, logout } = useAuth();
  const { theme } = useTheme();
  const gradientFor = (index: number) => theme.tabs[index % theme.tabs.length]?.gradient ?? theme.primaryGradient;

  return (
    <div className="app-shell">
      <div className="content">
        <header className="topbar">
          <div className="brand">
            <img className="brand-logo" src="/logo.png" alt="Light Rail Deals" />
            <div>
              <strong>Light Rail Deals</strong>
              <p className="muted">
                {profile?.email} · {profile?.role}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
      <nav className="bottom-tabs" aria-label="Primary">
        {NAV_ITEMS.map((item, index) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="bottom-tab">
            {({ isActive }) => (
              <>
                <span
                  className="bottom-tab-icon"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${gradientFor(index)[0]}, ${gradientFor(index)[1]})`,
                    opacity: isActive ? 1 : 0.55,
                  }}
                >
                  {item.icon}
                </span>
                <span className="bottom-tab-label">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
