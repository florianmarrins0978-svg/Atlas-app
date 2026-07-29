import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness : le process répond, un point c'est tout. Jamais d'accès base —
// une base indisponible ne doit jamais faire redémarrer un process
// applicatif par ailleurs sain (c'est le rôle de /api/health/ready).
export async function GET() {
  return NextResponse.json({ statut: "vivant" }, { status: 200 });
}
