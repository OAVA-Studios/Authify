import { useEffect, useState } from 'react';
import { client } from '@/lib/sdk';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import type { StorageBucket } from '@authify/sdk';

export default function StoragePage() {
  const [buckets, setBuckets] = useState<StorageBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await client.get('/v1/storage/buckets') as { data: StorageBucket[] };
      setBuckets(res.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load buckets', 'error');
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
        <h2 className="text-xl font-semibold text-slate-100">Storage</h2>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>New Bucket</Button>
      </div>

      <div className="rounded-md border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Public</TableHead>
              <TableHead>Max Size</TableHead>
              <TableHead>Allowed Types</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">Loading...</TableCell>
              </TableRow>
            ) : buckets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">No buckets</TableCell>
              </TableRow>
            ) : (
              buckets.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-slate-200">{b.name}</TableCell>
                  <TableCell>{b.public ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{b.maxFileSize.toLocaleString()} bytes</TableCell>
                  <TableCell>{b.allowedMimeTypes.join(', ') || 'All'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Create Bucket</DialogTitle>
        <DialogDescription>Add a new storage bucket.</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">Name</label>
          <Input placeholder="avatars" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary">Create</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
