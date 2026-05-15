import { NextResponse } from 'next/server';
import { reopenRow } from '@/lib/smartsheet';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const user = getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await reopenRow(params.rowId, user.name);
    return NextResponse.json({ ok: true, row: result });
  } catch (e) {
    console.error('POST /api/tasks/[rowId]/reopen error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
