// app/api/records/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Account from '@/lib/models/Account';

export const dynamic = 'force-dynamic';

const toDateGte = (yyyymmdd) => new Date(`${yyyymmdd}T00:00:00.000Z`);
const toDateLte = (yyyymmdd) => new Date(`${yyyymmdd}T23:59:59.999Z`);

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const search   = searchParams.get('search')   || '';
    const fromDate = searchParams.get('fromDate')  || '';
    const toDate   = searchParams.get('toDate')    || '';
    const scheme   = searchParams.get('scheme')    || '';
    const apy      = searchParams.get('apy')       || '';
    const unfreeze = searchParams.get('unfreeze')  || ''; // 'done' | 'pending'
    const passbook = searchParams.get('passbook')  || ''; // 'issued' | 'pending'
    const page     = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit    = Math.min(100, parseInt(searchParams.get('limit') || '10'));
    const skip     = (page - 1) * limit;

    const query = {};

    // ── Text search ──────────────────────────────────────────────────────────
    if (search.trim()) {
      const re = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { customerName: re },
        { accountNo:    re },
        { customerId:   re },
        { mobileNo:     re },
        { aadhaarNo:    re },
        { referenceNo:  re },
      ];
    }

    // ── Scheme / APY ─────────────────────────────────────────────────────────
    if (scheme)        query.scheme = scheme;
    if (apy === 'Yes') query.apy    = true;
    if (apy === 'No')  query.apy    = false;

    // ── Unfreeze / Passbook ──────────────────────────────────────────────────
    if (unfreeze === 'done')    query.unfreezeStatus = true;
    if (unfreeze === 'pending') query.unfreezeStatus = false;
    if (passbook === 'issued')  query.passbookIssued = true;
    if (passbook === 'pending') query.passbookIssued = false;

    // ── Date filter on accountOpenDate ("DD-MM-YYYY") ────────────────────────
    if (fromDate || toDate) {
      const dateExpr = {
        $dateFromString: {
          dateString: '$accountOpenDate',
          format:     '%d-%m-%Y',
          onError:    new Date(0),
          onNull:     new Date(0),
        },
      };
      const conditions = [];
      if (fromDate) conditions.push({ $gte: [dateExpr, toDateGte(fromDate)] });
      if (toDate)   conditions.push({ $lte: [dateExpr, toDateLte(toDate)]   });
      query.$expr = conditions.length === 1 ? conditions[0] : { $and: conditions };
    }

    // ── Query ────────────────────────────────────────────────────────────────
    const [records, total] = await Promise.all([
      Account.find(query)
        .select('-rawText -photoBase64')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Account.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch records', details: error.message },
      { status: 500 }
    );
  }
}