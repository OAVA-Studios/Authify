import { useAuth } from '@/store/auth';
import { Badge } from './ui/badge';

export function Navbar() {
  const user = useAuth((s) => s.user);

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
      <h1 className="text-sm font-semibold text-slate-100">Dashboard</h1>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="text-sm text-slate-400">{user.email}</span>
            <Badge variant="info">{user.role}</Badge>
          </>
        )}
      </div>
    </header>
  );
}
