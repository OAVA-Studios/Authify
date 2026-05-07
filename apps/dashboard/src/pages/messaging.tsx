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

  async function load() {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        client.get('/v1/messaging/providers') as Promise<{ data: MessagingProvider[] }>,
        client.get('/v1/messaging/templates') as Promise<{ data: MessageTemplate[] }>,
      ]);
      setProviders(p.data);
      setTemplates(t.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load messaging', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
          <Input placeholder="SMTP" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setProvOpen(false)}>Cancel</Button>
          <Button variant="primary">Create</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={tmplOpen} onClose={() => setTmplOpen(false)}>
        <DialogTitle>New Template</DialogTitle>
        <DialogDescription>Create an email/SMS/push template.</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">Name</label>
          <Input placeholder="welcome-email" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setTmplOpen(false)}>Cancel</Button>
          <Button variant="primary">Create</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
