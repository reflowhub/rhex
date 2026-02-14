import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCachedGeo, setCachedGeo, GeoResult } from "@/lib/geo-cache";

const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const knownSessions = new Set<string>();

function parseSource(referrer: string, search: string): string {
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const utmSource = params.get("utm_source");
      if (utmSource) return utmSource;
    } catch {}
  }
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    const own = process.env.NEXT_PUBLIC_SITE_DOMAIN || "rhex.app";
    if (url.hostname.includes(own)) return "direct";
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "direct";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, page, referrer, search, pagesVisited } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    // Extract IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

    // Resolve geolocation (cached)
    let geo: GeoResult | null = getCachedGeo(ip);
    if (!geo && ip !== "unknown") {
      try {
        const res = await fetch(
          `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,country,countryCode`
        );
        const data = await res.json();
        if (data.status === "success") {
          geo = {
            lat: data.lat,
            lng: data.lon,
            city: data.city || "Unknown",
            country: data.country || "Unknown",
            countryCode: data.countryCode || "??",
          };
          setCachedGeo(ip, geo);
        }
      } catch {
        // Geo lookup failed, continue without location
      }
    }

    // Hash IP for storage (privacy)
    const ipHash = await hashIP(ip);

    // Check if this is a new session (avoid extra Firestore read via in-memory set)
    let isNew = !knownSessions.has(sessionId);
    if (isNew) {
      const existing = await adminDb.collection("visitors").doc(sessionId).get();
      isNew = !existing.exists;
      knownSessions.add(sessionId);
    }

    const source = parseSource(referrer || "", search || "");

    // Upsert visitor document
    const now = new Date();
    const visitorRef = adminDb.collection("visitors").doc(sessionId);
    await visitorRef.set(
      {
        sessionId,
        ipHash,
        page: page || "/",
        lastSeen: now,
        pagesVisited: pagesVisited || 1,
        userAgent: request.headers.get("user-agent") || "",
        ...(isNew
          ? {
              firstSeen: now,
              entryPage: page || "/",
              referrer: referrer || "",
              source,
            }
          : {}),
        ...(geo
          ? {
              lat: geo.lat,
              lng: geo.lng,
              city: geo.city,
              country: geo.country,
              countryCode: geo.countryCode,
            }
          : {}),
      },
      { merge: true }
    );

    // Opportunistic cleanup: archive + delete stale docs (~5% of requests)
    if (Math.random() < 0.05) {
      const cutoff = new Date(Date.now() - STALE_THRESHOLD);
      const stale = await adminDb
        .collection("visitors")
        .where("lastSeen", "<", cutoff)
        .limit(20)
        .get();
      if (!stale.empty) {
        const batch = adminDb.batch();
        stale.docs.forEach((doc) => {
          const d = doc.data();
          const firstSeen =
            d.firstSeen?.toDate?.() ?? d.lastSeen?.toDate?.() ?? new Date();
          const lastSeen = d.lastSeen?.toDate?.() ?? new Date();
          const duration = Math.max(
            0,
            Math.floor((lastSeen.getTime() - firstSeen.getTime()) / 1000)
          );
          const pv = d.pagesVisited || 1;

          // Archive to sessions collection (idempotent via sessionId key)
          const sessionRef = adminDb
            .collection("sessions")
            .doc(d.sessionId);
          batch.set(sessionRef, {
            sessionId: d.sessionId,
            startedAt: firstSeen,
            endedAt: lastSeen,
            duration,
            pagesVisited: pv,
            bounced: pv <= 1,
            source: d.source || "direct",
            referrer: d.referrer || "",
            country: d.country || "Unknown",
            countryCode: d.countryCode || "",
            city: d.city || "",
            entryPage: d.entryPage || d.page || "/",
            lastPage: d.page || "/",
          });

          // Delete the stale visitor doc
          batch.delete(doc.ref);
          knownSessions.delete(d.sessionId);
        });
        await batch.commit();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Visitor heartbeat error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (process.env.IP_HASH_SALT || "rhex-salt"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
