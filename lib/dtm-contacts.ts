import { getPool } from "@/lib/db";

/**
 * The DTM-side people shown to every partner on their portal (see
 * PortalShell.tsx's "Your point of contact" card) — separate from the
 * per-company Sales lead resolved from Attio's own actor field, since these
 * are shared across every partner and staff need to be able to update one
 * person's details (or swap in a replacement) in one place rather than per
 * company. `status` is a free-text line like "On maternal leave — contact
 * Jonas instead" shown next to the person's name; leave it null when nothing
 * needs flagging. Managed from Global portal settings.
 */
export interface DtmContact {
  id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  sortOrder: number;
}

interface DtmContactRow {
  id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  sort_order: number;
}

function rowToContact(row: DtmContactRow): DtmContact {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    status: row.status,
    sortOrder: row.sort_order,
  };
}

export async function listDtmContacts(): Promise<DtmContact[]> {
  const { rows } = await getPool().query<DtmContactRow>(
    "SELECT id, name, role, email, phone, status, sort_order FROM dtm_contacts ORDER BY sort_order, id",
  );
  return rows.map(rowToContact);
}

export async function addDtmContact(
  input: { name: string; role: string | null; email: string | null; phone: string | null; status: string | null },
  updatedBy: string,
): Promise<void> {
  const { rows } = await getPool().query<{ next: number }>(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM dtm_contacts",
  );
  await getPool().query(
    `INSERT INTO dtm_contacts (name, role, email, phone, status, sort_order, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7)`,
    [input.name, input.role, input.email, input.phone, input.status, rows[0].next, updatedBy],
  );
}

export async function updateDtmContact(
  id: number,
  input: { name: string; role: string | null; email: string | null; phone: string | null; status: string | null },
  updatedBy: string,
): Promise<void> {
  await getPool().query(
    `UPDATE dtm_contacts SET name = $2, role = $3, email = $4, phone = $5, status = $6, updated_at = now(), updated_by = $7
     WHERE id = $1`,
    [id, input.name, input.role, input.email, input.phone, input.status, updatedBy],
  );
}

export async function deleteDtmContact(id: number): Promise<void> {
  await getPool().query("DELETE FROM dtm_contacts WHERE id = $1", [id]);
}
