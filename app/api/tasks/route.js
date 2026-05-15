import { NextResponse } from 'next/server';
import { getSheet, addRow } from '@/lib/smartsheet';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await getSheet();
    return NextResponse.json(data);
  } catch (e) {
    console.error('GET /api/tasks error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    if (!body.Tasks || !String(body.Tasks).trim()) {
      return NextResponse.json({ error: 'Tasks field is required' }, { status: 400 });
    }
    if (body.StartDate && body.EndDate && body.EndDate < body.StartDate) {
      return NextResponse.json({ error: 'EndDate cannot be earlier than StartDate' }, { status: 400 });
    }

    const created = await addRow({
      Category:  body.Category || null,
      Tasks:     body.Tasks,
      Owner:     body.Owner || null,
      Status:    body.Status || 'In Progress',
      Notes:     body.Notes || null,
      StartDate: body.StartDate || null,
      EndDate:   body.EndDate || null,
      Barriers:  body.Barriers || null,
    });
    return NextResponse.json({ ok: true, row: created });
  } catch (e) {
    console.error('POST /api/tasks error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
