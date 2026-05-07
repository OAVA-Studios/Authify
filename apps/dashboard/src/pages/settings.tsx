import { useState } from 'react';
import { useAuth } from '@/store/auth';
import { client } from '@/lib/sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';

export default function SettingsPage() {
  const user = useAuth((s) => s.user);
  const fetchMe = useAuth((s) => s.fetchMe);
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await client.patch('/v1/auth/me', { email });
      toast('Profile updated', 'success');
      await fetchMe();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await client.patch('/v1/auth/me', { currentPassword: currentPw, newPassword: newPw });
      toast('Password changed', 'success');
      setCurrentPw('');
      setNewPw('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Password change failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={updateProfile} className="space-y-4 max-w-md">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" disabled={loading}>Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4 max-w-md">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Current Password</label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">New Password</label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" disabled={loading}>Change Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
