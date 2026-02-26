'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, Loader2, Clock, Megaphone,
  ArrowLeft, Download, Copy,
} from 'lucide-react';
import Link from 'next/link';

// Types
interface AutoloadItem {
  id: string;
  feedId?: string;
  externalId: string;
  category: string;
  title: string;
  description?: string;
  price?: number;
  imageUrls?: string[];
  address?: string;
  dateBegin?: string;
  dateEnd?: string;
  promo?: string;
  promoAutoOptions?: string;
  promoManualOptions?: string;
  promoBid?: number;
  promoPeriod?: number;
  adStatus?: string;
  listingFee?: string;
  categoryFields?: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AutoloadFeed {
  id: string;
  projectId: string;
  name: string;
  format?: string;
  itemCount: number;
  lastGeneratedAt?: string;
  createdAt: string;
}

type PromoType = '' | 'Auto_1' | 'Auto_7' | 'Auto_30' | 'Manual';

const PROMO_LABELS: Record<string, string> = {
  '': 'No promotion',
  Auto_1: 'Auto-bid 1 day',
  Auto_7: 'Auto-bid 7 days',
  Auto_30: 'Auto-bid 30 days',
  Manual: 'Manual bid',
};

const AD_STATUS_LABELS: Record<string, string> = {
  '': 'None',
  Free: 'Free',
  Highlight: 'Highlight',
  XL: 'XL listing',
  x2_1: 'Boost x2',
  x5_1: 'Boost x5',
  x10_1: 'Boost x10',
};

interface ItemForm {
  externalId: string; category: string; title: string;
  description: string; price: string; imageUrls: string;
  address: string; dateBegin: string; dateEnd: string;
  promo: PromoType; promoAutoOptions: string;
  promoManualOptions: string; promoBid: string;
  promoPeriod: string; adStatus: string; listingFee: string;
}

const INIT: ItemForm = {
  externalId: '', category: '', title: '', description: '',
  price: '', imageUrls: '', address: '',
  dateBegin: '', dateEnd: '',
  promo: '', promoAutoOptions: '', promoManualOptions: '',
  promoBid: '', promoPeriod: '', adStatus: '', listingFee: '',
};

const fmtDate = (d?: string) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export default function AutoloadItemsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [items, setItems] = useState<AutoloadItem[]>([]);
  const [feeds, setFeeds] = useState<AutoloadFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<AutoloadItem | null>(null);
  const [form, setForm] = useState<ItemForm>(INIT);
  const [submitting, setSubmitting] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [genFeed, setGenFeed] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AutoloadItem[] | { items: AutoloadItem[] }>(
        `/autoload/items?projectId=${projectId}`
      );
      setItems(Array.isArray(data) ? data : data.items ?? []);
    } catch { toast.error({ title: 'Error', description: 'Failed to load items' }); }
    finally { setLoading(false); }
  }, [projectId]);

  const fetchFeeds = useCallback(async () => {
    try {
      const { data } = await api.get<AutoloadFeed[] | { items: AutoloadFeed[] }>(
        `/autoload/feeds?projectId=${projectId}`
      );
      setFeeds(Array.isArray(data) ? data : data.items ?? []);
    } catch {}
  }, [projectId]);

  useEffect(() => { fetchItems(); fetchFeeds(); }, [fetchItems, fetchFeeds]);

  const openCreate = () => { setEditing(null); setForm(INIT); setDialog(true); };

  const openEdit = (item: AutoloadItem) => {
    setEditing(item);
    setForm({
      externalId: item.externalId || '', category: item.category || '',
      title: item.title || '', description: item.description || '',
      price: item.price != null ? String(item.price) : '',
      imageUrls: (item.imageUrls || []).join('\n'),
      address: item.address || '',
      dateBegin: item.dateBegin || '', dateEnd: item.dateEnd || '',
      promo: (item.promo as PromoType) || '',
      promoAutoOptions: item.promoAutoOptions || '',
      promoManualOptions: item.promoManualOptions || '',
      promoBid: item.promoBid != null ? String(item.promoBid) : '',
      promoPeriod: item.promoPeriod != null ? String(item.promoPeriod) : '',
      adStatus: item.adStatus || '', listingFee: item.listingFee || '',
    });
    setDialog(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error({ title: 'Error', description: 'Title is required' });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        externalId: form.externalId || undefined,
        category: form.category || undefined,
        title: form.title.trim(),
        description: form.description || undefined,
        price: form.price ? parseFloat(form.price) : undefined,
        imageUrls: form.imageUrls ? form.imageUrls.split('\n').filter(Boolean) : undefined,
        address: form.address || undefined,
        dateBegin: form.dateBegin || undefined,
        dateEnd: form.dateEnd || undefined,
        promo: form.promo || null,
        promoAutoOptions: form.promoAutoOptions || null,
        promoManualOptions: form.promoManualOptions || null,
        promoBid: form.promoBid ? parseInt(form.promoBid) : null,
        promoPeriod: form.promoPeriod ? parseInt(form.promoPeriod) : null,
        adStatus: form.adStatus || null,
        listingFee: form.listingFee || undefined,
        projectId,
      };
      if (editing) {
        await api.put(`/autoload/items/${editing.id}`, payload);
        toast.success({ title: 'Success', description: 'Item updated' });
      } else {
        await api.post('/autoload/items', payload);
        toast.success({ title: 'Success', description: 'Item created' });
      }
      setDialog(false); setForm(INIT); setEditing(null);
      await fetchItems();
    } catch (err: any) {
      toast.error({ title: 'Error', description: err?.message || 'Failed to save' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!delId) return;
    setDeleting(true);
    try {
      await api.delete(`/autoload/items/${delId}`);
      toast.success({ title: 'Success', description: 'Item deleted' });
      setDelId(null); await fetchItems();
    } catch {
      toast.error({ title: 'Error', description: 'Failed to delete' });
    } finally { setDeleting(false); }
  };

  const handleGenXml = async (feedId: string) => {
    setGenFeed(feedId);
    try {
      const { data } = await api.get<string>(`/autoload/feeds/${feedId}/xml`);
      const blob = new Blob([data], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `feed-${feedId}.xml`; a.click();
      URL.revokeObjectURL(url);
      toast.success({ title: 'Success', description: 'XML generated' });
      await fetchFeeds();
    } catch {
      toast.error({ title: 'Error', description: 'Failed to generate XML' });
    } finally { setGenFeed(null); }
  };

  const copyUrl = (fid: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/api/autoload/feeds/${fid}/xml`);
    toast.success({ title: 'Copied', description: 'Feed URL copied' });
  };

  const upd = (k: keyof ItemForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href={`/app/projects/${projectId}/autoload`}>
              <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <h1 className="text-3xl font-bold">Autoload Items & Scheduling</h1>
          </div>
          <p className="text-muted-foreground ml-12">Manage items, scheduling, bids & XML feeds</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Item</Button>
      </div>

      {/* === ITEMS TABLE === */}
      <Card>
        <CardHeader><CardTitle>Items ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({length:5}).map((_,i)=>(<Skeleton key={i} className="h-10 w-full" />))}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No items yet</p>
              <p>Create your first autoload item to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead><Clock className="w-4 h-4 inline mr-1" />Schedule</TableHead>
                  <TableHead><Megaphone className="w-4 h-4 inline mr-1" />Promo</TableHead>
                  <TableHead>AdStatus</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.category || '\u2014'}</TableCell>
                    <TableCell>{item.price != null ? `${item.price} RUB` : '\u2014'}</TableCell>
                    <TableCell>
                      {item.dateBegin ? fmtDate(item.dateBegin) : '\u2014'}
                      {item.dateEnd ? ` \u2192 ${fmtDate(item.dateEnd)}` : ''}
                    </TableCell>
                    <TableCell>
                      {item.promo ? <Badge variant="secondary">{PROMO_LABELS[item.promo] || item.promo}</Badge> : '\u2014'}
                    </TableCell>
                    <TableCell>
                      {item.adStatus ? <Badge>{AD_STATUS_LABELS[item.adStatus] || item.adStatus}</Badge> : '\u2014'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDelId(item.id)} title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* === XML FEEDS === */}
      {feeds.length > 0 && (
        <Card>
          <CardHeader><CardTitle>XML Feeds</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Last Generated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeds.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.itemCount}</TableCell>
                    <TableCell>{fmtDate(f.lastGeneratedAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleGenXml(f.id)} disabled={genFeed === f.id}>
                          {genFeed === f.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                          Generate XML
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyUrl(f.id)}>
                          <Copy className="w-4 h-4 mr-1" />Copy URL
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* === CREATE/EDIT DIALOG === */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Item' : 'Create Item'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update item settings, scheduling and bidding' : 'Add a new item with optional scheduling and promotion'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* --- Basic Info --- */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Basic Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="title">Title *</Label><Input id="title" value={form.title} onChange={e => upd('title', e.target.value)} placeholder="Item title" /></div>
                <div><Label htmlFor="extId">External ID</Label><Input id="extId" value={form.externalId} onChange={e => upd('externalId', e.target.value)} placeholder="SKU-123" /></div>
                <div><Label htmlFor="category">Category</Label><Input id="category" value={form.category} onChange={e => upd('category', e.target.value)} placeholder="Category name" /></div>
                <div><Label htmlFor="price">Price (RUB)</Label><Input id="price" type="number" min="0" value={form.price} onChange={e => upd('price', e.target.value)} placeholder="0" /></div>
              </div>
              <div><Label htmlFor="desc">Description</Label><Input id="desc" value={form.description} onChange={e => upd('description', e.target.value)} placeholder="Item description" /></div>
              <div><Label htmlFor="addr">Address</Label><Input id="addr" value={form.address} onChange={e => upd('address', e.target.value)} placeholder="City, Street" /></div>
            </div>

            {/* --- Scheduling --- */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />Scheduling
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateBegin">Date Begin</Label>
                  <Input id="dateBegin" type="datetime-local" value={form.dateBegin} onChange={e => upd('dateBegin', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="dateEnd">Date End</Label>
                  <Input id="dateEnd" type="datetime-local" value={form.dateEnd} onChange={e => upd('dateEnd', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Set when this ad should start and optionally end on Avito</p>
            </div>

            {/* --- Promotion & Bidding --- */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Megaphone className="w-4 h-4" />Promotion & Bidding
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Promo Type</Label>
                  <Select value={form.promo} onValueChange={v => upd('promo', v)}>
                    <SelectTrigger><SelectValue placeholder="No promotion" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROMO_LABELS).map(([k, lbl]) => (
                        <SelectItem key={k} value={k || '_none'}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ad Status (service)</Label>
                  <Select value={form.adStatus} onValueChange={v => upd('adStatus', v)}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(AD_STATUS_LABELS).map(([k, lbl]) => (
                        <SelectItem key={k} value={k || '_none'}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Auto-bid options: city|budget per line */}
              {(form.promo === 'Auto_1' || form.promo === 'Auto_7' || form.promo === 'Auto_30') && (
                <div className="col-span-2">
                  <Label htmlFor="promoAuto">Auto-Bid City Budgets</Label>
                  <textarea
                    id="promoAuto"
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.promoAutoOptions}
                    onChange={e => upd('promoAutoOptions', e.target.value)}
                    placeholder={"City|Budget per line, e.g.:\nMoscow|20000\nSaint-Petersburg|15000"}
                  />
                  <p className="text-xs text-muted-foreground mt-1">One city per line: City|Budget. Leave city empty for account region: |Budget</p>
                </div>
              )}

              {/* Manual bid options: city|price|limit per line */}
              {form.promo === 'Manual' && (
                <div className="col-span-2">
                  <Label htmlFor="promoManual">Manual Bid Settings</Label>
                  <textarea
                    id="promoManual"
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.promoManualOptions}
                    onChange={e => upd('promoManualOptions', e.target.value)}
                    placeholder={"City|Price|Limit per line, e.g.:\nMoscow|50|500\nSaint-Petersburg|40|400"}
                  />
                  <p className="text-xs text-muted-foreground mt-1">One city per line: City|TargetPrice|DailyLimit. Limit must be greater than price</p>
                </div>
              )}

              {form.promo && form.promo !== '' && (
                <>
                  <div>
                    <Label htmlFor="promoBid">Bid Amount (RUB)</Label>
                    <Input id="promoBid" type="number" min="0" value={form.promoBid} onChange={e => upd('promoBid', e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label htmlFor="promoPeriod">Period (days)</Label>
                    <Input id="promoPeriod" type="number" min="1" value={form.promoPeriod} onChange={e => upd('promoPeriod', e.target.value)} placeholder="7" />
                  </div>
                </>
              )}

              <p className="text-xs text-muted-foreground col-span-2">
                Promo and AdStatus are written to Avito XML. Note: Commission-based and target-action pricing cannot be enabled simultaneously.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DELETE CONFIRMATION === */}
      <Dialog open={!!delId} onOpenChange={open => { if (!open) setDelId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>Are you sure you want to delete this item? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
