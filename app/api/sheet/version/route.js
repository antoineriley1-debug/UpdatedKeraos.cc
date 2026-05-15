import { NextResponse } from 'next/server';
import { getSheetVersion } from '@/lib/smartsheet';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await getSheetVersion();
    return NextResponse.json(data);
  } catch (e) {
    console.error('GET /api/sheet/version error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
