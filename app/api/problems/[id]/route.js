// app/api/problems/[id]/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Problem from '@/lib/models/Problem';

export const dynamic = 'force-dynamic';

// PATCH: toggle status done/pending
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, doneBy, feedback } = body;

    if (!['pending', 'done'].includes(status)) {
      return NextResponse.json({ error: 'status must be pending or done' }, { status: 400 });
    }

    await connectDB();
    const update = {
      status,
      doneAt: status === 'done' ? new Date() : null,
      doneBy: status === 'done' ? (doneBy || '') : '',
      feedback: status === 'done' ? (feedback?.trim() || '') : '',
    };

    const problem = await Problem.findByIdAndUpdate(id, update, { new: true });
    if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, problem });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: remove a problem entry
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await connectDB();
    await Problem.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}