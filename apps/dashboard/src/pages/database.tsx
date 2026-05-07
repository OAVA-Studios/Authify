import { useEffect, useState } from 'react';
import { client } from '@/lib/sdk';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import type { Collection } from '@authify/sdk';

export default function DatabasePage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [tableName, setTableName] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await client.get<Collection[]>('/v1/database/collections');
      setCollections(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load collections', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createCollection() {
    if (!name.trim() || !tableName.trim()) {
      toast('Name and table name are required', 'error');
      return;
    }
    try {
      await client.post('/v1/database/collections', {
        name: name.trim(),
        tableName: tableName.trim(),
        schema: {},
        rlsEnabled: true,
      });
      toast('Collection created', 'success');
      setOpen(false);
      setName('');
      setTableName('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create collection', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Database</h2>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>New Collection</Button>
      </div>

      <div className="rounded-md border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>RLS</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">Loading...</TableCell>
              </TableRow>
            ) : collections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">No collections</TableCell>
              </TableRow>
            ) : (
              collections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-slate-200">{c.name}</TableCell>
                  <TableCell>{c.tableName}</TableCell>
                  <TableCell>{c.rlsEnabled ? 'Enabled' : 'Disabled'}</TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Create Collection</DialogTitle>
        <DialogDescription>Define a new collection schema.</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">Name</label>
          <Input placeholder="users" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="block text-sm text-slate-300">Table Name</label>
          <Input placeholder="users" value={tableName} onChange={(e) => setTableName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={createCollection}>Create</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
