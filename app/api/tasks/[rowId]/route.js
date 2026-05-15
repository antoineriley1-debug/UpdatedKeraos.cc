import { NextResponse } from 'next/server';
import { updateRow } from '@/lib/smartsheet';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EDITABLE_FIELDS = ['Tasks', 'Owner', 'Category', 'Status', 'Notes', 'StartDate', 'EndDate', 'Barriers'];

export async function PATCH(request, { params }) {
  try {
    const user = getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rowId } = params;
    const body = await request.json();

    const updates = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in body) updates[key] = body[key] === '' ? null : body[key];
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No editable fields in request' }, { status: 400 });
    }
    if ('Tasks' in updates && (!updates.Tasks || !String(updates.Tasks).trim())) {
      return NextResponse.json({ error: 'Tasks cannot be empty' }, { status: 400 });
    }
    if (updates.StartDate && updates.EndDate && updates.EndDate < updates.StartDate) {
      return NextResponse.json({ error: 'EndDate cannot be earlier than StartDate' }, { status: 400 });
    }

    const result = await updateRow(rowId, updates);
    return NextResponse.json({ ok: true, row: result });
  } catch (e) {
    console.error('PATCH /api/tasks/[rowId] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
