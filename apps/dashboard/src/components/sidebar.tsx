import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  KeyRound,
  Database,
  HardDrive,
  FunctionSquare,
  Mail,
  Webhook,
  Settings,
  LogOut,
  Radio,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/licensing', icon: KeyRound, label: 'Licensing' },
  { to: '/database', icon: Database, label: 'Database' },
  { to: '/storage', icon: HardDrive, label: 'Storage' },
  { to: '/functions', icon: FunctionSquare, label: 'Functions' },
  { to: '/messaging', icon: Mail, label: 'Messaging' },
  { to: '/webhooks', icon: Webhook, label: 'Webhooks' },
  { to: '/realtime', icon: Radio, label: 'Realtime' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const logout = useAuth((s) => s.logout);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex h-14 items-center border-b border-slate-800 px-6">
        <span className="text-lg font-bold tracking-tight text-white">Authify</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {nav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-200"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
