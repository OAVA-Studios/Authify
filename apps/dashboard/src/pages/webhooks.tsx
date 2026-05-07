import { useEffect, useState } from 'react';
import { client } from '@/lib/sdk';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import type { Webhook } from '@authify/sdk';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await client.get('/v1/webhooks') as { data: Webhook[] };
      setWebhooks(res.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load webhooks', 'error');
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
        <h2 className="text-xl font-semibold text-slate-100">Webhooks</h2>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>New Webhook</Button>
      </div>

      <div className="rounded-md border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Retries</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">Loading...</TableCell>
              </TableRow>
            ) : webhooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">No webhooks</TableCell>
              </TableRow>
            ) : (
              webhooks.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium text-slate-200">{w.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{w.url}</TableCell>
                  <TableCell>{w.events.join(', ')}</TableCell>
                  <TableCell>
                    {w.active ? <Badge variant="success">Active</Badge> : <Badge variant="default">Inactive</Badge>}
                  </TableCell>
                  <TableCell>{w.retries}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Create Webhook</DialogTitle>
        <DialogDescription>Configure a new webhook endpoint.</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">Name</label>
          <Input placeholder="stripe-events" />
          <label className="block text-sm text-slate-300">URL</label>
          <Input placeholder="https://example.com/webhook" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary">Create</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
