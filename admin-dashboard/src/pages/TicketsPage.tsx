import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Badge, Button, DataTable, EmptyState, ErrorBanner, Input, Modal, PageCard, Select, Spinner } from '../components/Ui';
import { createAdminTicket, deleteAdminTicket, listAdminTickets, updateAdminTicket } from '../lib/api';
import { scanImageToText } from '../lib/ocr';
import type { TicketRecord } from '../lib/types';

const BARCODE_FORMATS = [
  'Codabar',
  'Code 11',
  'Code 128',
  'Code 39',
  'Extended Code 39',
  'Code 93',
  'EAN-13',
  'EAN-8',
  'Industrial 2 of 5',
  'Interleaved 2 of 5',
  'ITF-14',
  'MSI (MSI Plessey)',
  'Plessey',
  'SCC-14',
  'Standard 2 of 5',
  'UCC/EAN-128',
  'UCC/EAN Shipping Container Code',
  'UPC-A',
  'Australia Postal Code',
  'Aztec Code',
  'Composite Code',
  'DataMatrix',
  'Maxicode',
  'PDF-417',
  'Postnet',
  'QR Code',
];

function barcodeFromScanText(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const code = lines.find((line) => /^[A-Z0-9-]{4,}$/i.test(line));
  return code ?? lines[0] ?? '';
}

function isInvalid(ticket: TicketRecord): boolean {
  return ticket.usedUses >= ticket.allowedUses || ticket.status === 'used' || ticket.status === 'disabled';
}

export function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TicketRecord | null>(null);

  const [name, setName] = useState('Event Ticket');
  const [barcode, setBarcode] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState('Code 128');
  const [allowedUses, setAllowedUses] = useState('1');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setTickets(await listAdminTickets());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tickets');
    } finally {
      setLoading(false);
    }
  }

  async function handleScan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      const text = await scanImageToText(file);
      const code = barcodeFromScanText(text);
      setBarcode(code);
      if (!code) setError('Could not read a barcode from the image. Type it manually.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!barcode.trim()) return;
    setError(null);
    try {
      await createAdminTicket({
        barcode: barcode.trim(),
        barcodeFormat,
        name: name.trim() || 'Event Ticket',
        allowedUses: Number(allowedUses) || 1,
      });
      setBarcode('');
      setBarcodeFormat('Code 128');
      setName('Event Ticket');
      setAllowedUses('1');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create ticket');
    }
  }

  async function handleUpdate(updated: TicketRecord) {
    setError(null);
    try {
      await updateAdminTicket(updated.id, {
        name: updated.name,
        barcode: updated.barcode,
        barcodeFormat: updated.barcodeFormat,
        allowedUses: updated.allowedUses,
        usedUses: updated.usedUses,
        status: updated.status,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update ticket');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this ticket?')) return;
    setError(null);
    try {
      await deleteAdminTicket(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete ticket');
    }
  }

  const statusTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
    active: 'success',
    used: 'neutral',
    disabled: 'danger',
  };

  return (
    <div className="stack">
      <PageCard title="Ticket editor" subtitle="Add tickets by scanning or typing the barcode. Choose a barcode format and set max uses.">
        {error ? <ErrorBanner message={error} /> : null}
        <form className="form" onSubmit={handleCreate}>
          <div className="grid-2">
            <label>
              Ticket name
              <Input placeholder="Ticket name" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Max uses
              <Input type="number" min={1} value={allowedUses} onChange={(e) => setAllowedUses(e.target.value)} required />
            </label>
          </div>
          <div className="grid-2">
            <label>
              Barcode
              <Input placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} required />
            </label>
            <label>
              Barcode format
              <Select value={barcodeFormat} onChange={(e) => setBarcodeFormat(e.target.value)}>
                {BARCODE_FORMATS.map((format) => (
                  <option key={format} value={format}>{format}</option>
                ))}
              </Select>
            </label>
          </div>
          <div className="inline-row">
            <Button type="submit" disabled={scanning}>Add ticket</Button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              {scanning ? 'Scanning…' : 'Scan barcode image'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScan} />
            </label>
          </div>
        </form>
      </PageCard>

      <PageCard title="All tickets" subtitle="A ticket is invalid once it reaches its max uses.">
        {loading ? <Spinner /> : null}
        {!loading && tickets.length === 0 ? <EmptyState title="No tickets" description="Add a ticket above or scan a barcode to get started." /> : null}
        {!loading && tickets.length > 0 ? (
          <DataTable>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Barcode</th>
                  <th>Format</th>
                  <th>Uses</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{ticket.name}</td>
                    <td><code>{ticket.barcode}</code></td>
                    <td>{ticket.barcodeFormat ?? '—'}</td>
                    <td>{ticket.usedUses} / {ticket.allowedUses}</td>
                    <td>
                      {isInvalid(ticket) ? (
                        <Badge tone="danger">invalid</Badge>
                      ) : (
                        <Badge tone={statusTone[ticket.status]}>{ticket.status}</Badge>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button variant="secondary" onClick={() => setEditing(ticket)}>Edit</Button>
                        <Button variant="danger" onClick={() => void handleDelete(ticket.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : null}
      </PageCard>

      <Modal open={editing !== null} title="Edit ticket" onClose={() => setEditing(null)}>
        {editing ? (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleUpdate(editing);
            }}
          >
            <label>
              Name
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </label>
            <label>
              Barcode
              <Input value={editing.barcode} onChange={(e) => setEditing({ ...editing, barcode: e.target.value })} required />
            </label>
            <label>
              Barcode format
              <Select value={editing.barcodeFormat ?? 'Code 128'} onChange={(e) => setEditing({ ...editing, barcodeFormat: e.target.value })}>
                {BARCODE_FORMATS.map((format) => (
                  <option key={format} value={format}>{format}</option>
                ))}
              </Select>
            </label>
            <label>
              Allowed uses
              <Input type="number" min={editing.usedUses} value={editing.allowedUses} onChange={(e) => setEditing({ ...editing, allowedUses: Number(e.target.value) })} required />
            </label>
            <label>
              Used uses
              <Input type="number" min={0} value={editing.usedUses} onChange={(e) => setEditing({ ...editing, usedUses: Number(e.target.value) })} required />
            </label>
            <label>
              Status
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as TicketRecord['status'] })}>
                <option value="active">active</option>
                <option value="used">used</option>
                <option value="disabled">disabled</option>
              </Select>
            </label>
            <div className="row-actions">
              <Button type="submit">Save</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
