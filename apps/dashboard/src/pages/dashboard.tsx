import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  KeyRound,
  Database,
  HardDrive,
  FunctionSquare,
  Mail,
  Webhook,
  Radio,
} from 'lucide-react';

const stats = [
  { label: 'Users', icon: Users, value: '—', color: 'text-blue-400' },
  { label: 'License Keys', icon: KeyRound, value: '—', color: 'text-amber-400' },
  { label: 'Collections', icon: Database, value: '—', color: 'text-emerald-400' },
  { label: 'Files', icon: HardDrive, value: '—', color: 'text-purple-400' },
  { label: 'Functions', icon: FunctionSquare, value: '—', color: 'text-pink-400' },
  { label: 'Messages', icon: Mail, value: '—', color: 'text-cyan-400' },
  { label: 'Webhooks', icon: Webhook, value: '—', color: 'text-orange-400' },
  { label: 'Realtime Conn.', icon: Radio, value: '—', color: 'text-rose-400' },
];

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const fetchMe = useAuth((s) => s.fetchMe);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      fetchMe().catch(() => navigate('/login'));
    }
  }, [user, fetchMe, navigate]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Overview</h2>
        <p className="text-sm text-slate-400">Welcome back, {user?.email ?? '...'}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-400">
                <s.icon className={cn('h-4 w-4', s.color)} />
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-100">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
