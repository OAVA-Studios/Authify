import { useEffect, useState } from 'react';
import { client } from '@/lib/sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import type { RealtimeChannelInfo, RealtimeStats } from '@authify/sdk';

export default function RealtimePage() {
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [channels, setChannels] = useState<RealtimeChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelName, setChannelName] = useState('');
  const [eventName, setEventName] = useState('');
  const [payload, setPayload] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        client.get<RealtimeStats>('/v1/realtime/stats'),
        client.get<RealtimeChannelInfo[]>('/v1/realtime/channels'),
      ]);
      setStats(s);
      setChannels(c);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load realtime stats', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  async function broadcast() {
    try {
      await client.post('/v1/realtime/broadcast', {
        channel: channelName,
        event: eventName || 'broadcast',
        payload: payload ? JSON.parse(payload) : {},
      });
      toast('Broadcast sent', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Broadcast failed', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Realtime</h2>
        <Button variant="secondary" size="sm" onClick={load}>Refresh</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-100">{stats?.totalConnections ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-100">{stats?.totalChannels ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3 rounded-md border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Broadcast</h3>
        <div className="flex gap-2">
          <Input placeholder="Channel" value={channelName} onChange={(e) => setChannelName(e.target.value)} className="w-48" />
          <Input placeholder="Event" value={eventName} onChange={(e) => setEventName(e.target.value)} className="w-48" />
          <Input placeholder='Payload JSON' value={payload} onChange={(e) => setPayload(e.target.value)} className="flex-1" />
          <Button variant="primary" onClick={broadcast}>Send</Button>
        </div>
      </div>

      <div className="rounded-md border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Subscribers</TableHead>
              <TableHead>Presence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-slate-500">Loading...</TableCell>
              </TableRow>
            ) : channels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-slate-500">No channels</TableCell>
              </TableRow>
            ) : (
              channels.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium text-slate-200">{c.name}</TableCell>
                  <TableCell>{c.subscriberCount}</TableCell>
                  <TableCell>{c.presence.length}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
