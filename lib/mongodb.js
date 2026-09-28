// lib/mongodb.js  (or lib/dbConnect.js — use whichever name your project uses)
// ─────────────────────────────────────────────────────────────────────────────
// M0 free tier limit: 500 total connections across ALL clients.
// Next.js dev mode creates a new module instance on every hot-reload,
// so without the global cache every reload opens a fresh pool.
//
// Key settings for M0:
//   maxPoolSize: 5   — at most 5 sockets per Next.js instance
//   minPoolSize: 1   — keep 1 alive so first request is fast
//   serverSelectionTimeoutMS: 5000  — fail fast instead of hanging
//   socketTimeoutMS: 30000          — close idle sockets after 30s
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in .env.local');
}

// Reuse the connection across hot-reloads in development
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // Return existing connection immediately — no new socket needed
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,

      // ── Pool size — most important setting for M0 ──────────────────────────
      // With 5 max and ~10 Vercel/Node instances you use ≤50 of your 500 limit
      maxPoolSize:  5,
      minPoolSize:  1,

      // ── Timeouts ───────────────────────────────────────────────────────────
      serverSelectionTimeoutMS: 5000,   // Give up finding a server after 5s
      socketTimeoutMS:         45000,   // Close idle socket after 45s
      connectTimeoutMS:        10000,   // TCP connect timeout

      // ── Heartbeat — reduces idle connection churn ──────────────────────────
      heartbeatFrequencyMS: 30000,      // Check server every 30s (default 10s)
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(m => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;   // Allow retry on next request
    throw e;
  }

  return cached.conn;
}

export default connectDB;