// app/api/records/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Account from '@/lib/models/Account';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const search   = searchParams.get('search')   || '';
    const fromDate = searchParams.get('fromDate')  || '';
    const toDate   = searchParams.get('toDate')    || '';
    const page     = parseInt(searchParams.get('page') || '1');
    const limit    = 10;
    const skip     = (page - 1) * limit;

    // Build query
    const query = {};

    // Text search across key fields
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

    // Date filter on accountOpenDate (stored as "DD-MM-YYYY")
    // Convert to comparable format for range query using createdAt
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const [fy, fm, fd] = fromDate.split('-');
        query.createdAt.$gte = new Date(`${fy}-${fm}-${fd}T00:00:00.000Z`);
      }
      if (toDate) {
        const [ty, tm, td] = toDate.split('-');
        query.createdAt.$lte = new Date(`${ty}-${tm}-${td}T23:59:59.999Z`);
      }
    }

    const [records, total] = await Promise.all([
      Account.find(query)
        .select('-rawText -photoBase64')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Account.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch records', details: error.message },
      { status: 500 }
    );
  }
}
