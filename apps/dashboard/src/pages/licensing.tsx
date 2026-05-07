import { useEffect, useState } from 'react';
import { client } from '@/lib/sdk';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LicenseApp, LicenseKey } from '@authify/sdk';

export default function LicensingPage() {
  const [apps, setApps] = useState<LicenseApp[]>([]);
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [appOpen, setAppOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [keyAppId, setKeyAppId] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [a, k] = await Promise.all([
        client.get<LicenseApp[]>('/v1/licensing/apps'),
        client.get<LicenseKey[]>('/v1/licensing/keys'),
      ]);
      setApps(a);
      setKeys(k);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load licensing', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createApp() {
    if (!appName.trim()) {
      toast('Name is required', 'error');
      return;
    }
    try {
      await client.post('/v1/licensing/apps', {
        name: appName.trim(),
        version: '1.0.0',
        hwidLocking: true,
        maxDevices: 1,
        antiDebug: false,
      });
      toast('License app created', 'success');
      setAppOpen(false);
      setAppName('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create app', 'error');
    }
  }

  async function createKey() {
    if (!keyAppId.trim()) {
      toast('App ID is required', 'error');
      return;
    }
    try {
      await client.post('/v1/licensing/keys', {
        appId: keyAppId.trim(),
        tier: 'basic',
        maxActivations: 1,
        quantity: 1,
      });
      toast('License key created', 'success');
      setKeyOpen(false);
      setKeyAppId('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create key', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Licensing</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAppOpen(true)}>New App</Button>
          <Button variant="primary" size="sm" onClick={() => setKeyOpen(true)}>New Key</Button>
        </div>
      </div>

      <Tabs defaultValue="apps">
        <TabsList>
          <TabsTrigger value="apps">Apps</TabsTrigger>
          <TabsTrigger value="keys">Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="apps">
          <div className="rounded-md border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>HWID Lock</TableHead>
                  <TableHead>Max Devices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">Loading...</TableCell>
                  </TableRow>
                ) : apps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">No apps</TableCell>
                  </TableRow>
                ) : (
                  apps.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-slate-200">{a.name}</TableCell>
                      <TableCell>{a.version}</TableCell>
                      <TableCell>{a.hwidLocking ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{a.maxDevices}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="keys">
          <div className="rounded-md border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Activations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">Loading...</TableCell>
                  </TableRow>
                ) : keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">No keys</TableCell>
                  </TableRow>
                ) : (
                  keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-mono text-xs text-slate-300">{k.key}</TableCell>
                      <TableCell>{k.tier}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            k.status === 'active'
                              ? 'success'
                              : k.status === 'banned' || k.status === 'revoked'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {k.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {k.currentActivations}/{k.maxActivations}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={appOpen} onClose={() => setAppOpen(false)}>
        <DialogTitle>Create License App</DialogTitle>
        <DialogDescription>Add a new application for license management.</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">Name</label>
          <Input placeholder="My App" value={appName} onChange={(e) => setAppName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAppOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={createApp}>Create</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={keyOpen} onClose={() => setKeyOpen(false)}>
        <DialogTitle>Create License Key</DialogTitle>
        <DialogDescription>Generate a new license key.</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">App ID</label>
          <Input placeholder="uuid" value={keyAppId} onChange={(e) => setKeyAppId(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setKeyOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={createKey}>Create</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
