import { useEffect, useState } from 'react';
import { client } from '@/lib/sdk';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import type { ServerlessFunction } from '@authify/sdk';

export default function FunctionsPage() {
  const [functions, setFunctions] = useState<ServerlessFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await client.get<ServerlessFunction[]>('/v1/functions');
      setFunctions(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load functions', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createFunction() {
    if (!name.trim() || !slug.trim()) {
      toast('Name and slug are required', 'error');
      return;
    }
    try {
      await client.post('/v1/functions', {
        name: name.trim(),
        slug: slug.trim(),
        sourceCode: 'module.exports = async (ctx) => { return { status: 200, body: "Hello from Authify" }; };',
        runtime: 'node22',
        entrypoint: 'index.js',
        triggerType: 'http',
        envVars: {},
        triggerConfig: {},
        timeout: 30000,
        memory: 256,
      });
      toast('Function created', 'success');
      setOpen(false);
      setName('');
      setSlug('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create function', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Functions</h2>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>New Function</Button>
      </div>

      <div className="rounded-md border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Runtime</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">Loading...</TableCell>
              </TableRow>
            ) : functions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">No functions</TableCell>
              </TableRow>
            ) : (
              functions.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium text-slate-200">{f.name}</TableCell>
                  <TableCell>{f.slug}</TableCell>
                  <TableCell>{f.runtime}</TableCell>
                  <TableCell>{f.triggerType}</TableCell>
                  <TableCell>
                    {f.active ? <Badge variant="success">Active</Badge> : <Badge variant="default">Inactive</Badge>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Create Function</DialogTitle>
        <DialogDescription>Deploy a new serverless function.</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">Name</label>
          <Input placeholder="my-function" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="block text-sm text-slate-300">Slug</label>
          <Input placeholder="my-function" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={createFunction}>Create</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
