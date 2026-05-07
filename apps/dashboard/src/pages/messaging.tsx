import { useEffect, useState } from 'react';
import { client } from '@/lib/sdk';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MessagingProvider, MessageTemplate } from '@authify/sdk';

export default function MessagingPage() {
  const [providers, setProviders] = useState<MessagingProvider[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [provOpen, setProvOpen] = useState(false);
  const [tmplOpen, setTmplOpen] = useState(false);
  const [provName, setProvName] = useState('');
  const [provType, setProvType] = useState('smtp');
  const [tmplName, setTmplName] = useState('');
  const [tmplType, setTmplType] = useState('email');
  const [tmplBody, setTmplBody] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        client.get<MessagingProvider[]>('/v1/messaging/providers'),
        client.get<MessageTemplate[]>('/v1/messaging/templates'),
      ]);
      setProviders(p);
      setTemplates(t);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load messaging', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createProvider() {
    if (!provName.trim()) {
      toast('Name is required', 'error');
      return;
    }
    try {
      await client.post('/v1/messaging/providers', {
        name: provName.trim(),
        type: provType,
        config: {},
        isDefault: false,
      });
      toast('Provider created', 'success');
      setProvOpen(false);
      setProvName('');
      setProvType('smtp');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create provider', 'error');
    }
  }

  async function createTemplate() {
    if (!tmplName.trim()) {
      toast('Name is required', 'error');
      return;
    }
    try {
      await client.post('/v1/messaging/templates', {
        name: tmplName.trim(),
        type: tmplType,
        body: tmplBody || ' ',
        variables: [],
      });
      toast('Template created', 'success');
      setTmplOpen(false);
      setTmplName('');
      setTmplType('email');
      setTmplBody('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create template', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Messaging</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setProvOpen(true)}>New Provider</Button>
          <Button variant="primary" size="sm" onClick={() => setTmplOpen(true)}>New Template</Button>
        </div>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="providers">
          <div className="rounded-md border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">Loading...</TableCell>
                  </TableRow>
                ) : providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">No providers</TableCell>
                  </TableRow>
                ) : (
                  providers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-slate-200">{p.name}</TableCell>
                      <TableCell>{p.type}</TableCell>
                      <TableCell>{p.isDefault ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{p.active ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="rounded-md border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-slate-500">Loading...</TableCell>
                  </TableRow>
                ) : templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-slate-500">No templates</TableCell>
                  </TableRow>
                ) : (
                  templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-slate-200">{t.name}</TableCell>
                      <TableCell>{t.type}</TableCell>
                      <TableCell>{t.subject || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={provOpen} onClose={() => setProvOpen(false)}>
        <DialogTitle>New Provider</DialogTitle>
        <DialogDescription>Configure a messaging provider.</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">Name</label>
          <Input placeholder="SMTP" value={provName} onChange={(e) => setProvName(e.target.value)} />
          <label className="block text-sm text-slate-300">Type</label>
          <select
            value={provType}
            onChange={(e) => setProvType(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="smtp">SMTP</option>
            <option value="resend">Resend</option>
            <option value="mailgun">Mailgun</option>
            <option value="sendgrid">Sendgrid</option>
            <option value="twilio">Twilio</option>
            <option value="vonage">Vonage</option>
            <option value="fcm">FCM</option>
          </select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setProvOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={createProvider}>Create</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={tmplOpen} onClose={() => setTmplOpen(false)}>
        <DialogTitle>New Template</DialogTitle>
        <DialogDescription>Create an email/SMS/push template.</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">Name</label>
          <Input placeholder="welcome-email" value={tmplName} onChange={(e) => setTmplName(e.target.value)} />
          <label className="block text-sm text-slate-300">Type</label>
          <select
            value={tmplType}
            onChange={(e) => setTmplType(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
          </select>
          <label className="block text-sm text-slate-300">Body</label>
          <textarea
            value={tmplBody}
            onChange={(e) => setTmplBody(e.target.value)}
            placeholder="Hello {{name}}!"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setTmplOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={createTemplate}>Create</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
