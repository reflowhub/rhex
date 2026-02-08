import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { isValidIMEI, extractTAC } from "@/lib/imei";

// POST /api/imei — Lookup device by IMEI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imei } = body;

    if (!imei || typeof imei !== "string") {
      return NextResponse.json(
        { error: "imei is required" },
        { status: 400 }
      );
    }

    const cleaned = imei.replace(/[\s\-]/g, "");

    if (!isValidIMEI(cleaned)) {
      return NextResponse.json({
        valid: false,
        error: "Invalid IMEI number",
      });
    }

    const tac = extractTAC(cleaned);

    // Check TAC cache in Firestore
    const tacDoc = await adminDb.collection("tacLookup").doc(tac).get();

    if (tacDoc.exists) {
      const cached = tacDoc.data()!;
      if (cached.deviceId) {
        const deviceDoc = await adminDb
          .collection("devices")
          .doc(cached.deviceId)
          .get();
        if (deviceDoc.exists) {
          const device = deviceDoc.data()!;
          return NextResponse.json({
            valid: true,
            tac,
            make: device.make,
            model: device.model,
            storage: device.storage,
            deviceId: cached.deviceId,
            deviceName: `${device.make} ${device.model} ${device.storage}`,
            source: "cache",
            storageOptions: null,
            needsStorageSelection: false,
            needsManualSelection: false,
          });
        }
      }

      // Cached but no deviceId — try matching again (new devices may have been added)
      const matchResult = await matchToLibrary(
        cached.make,
        cached.model,
        cached.storage
      );

      if (matchResult.deviceId) {
        await adminDb
          .collection("tacLookup")
          .doc(tac)
          .update({ deviceId: matchResult.deviceId });
      }

      return NextResponse.json({
        valid: true,
        tac,
        make: cached.make,
        model: cached.model,
        storage: matchResult.storage,
        deviceId: matchResult.deviceId,
        deviceName: matchResult.deviceName,
        source: "cache",
        storageOptions: matchResult.storageOptions,
        needsStorageSelection: matchResult.needsStorageSelection,
        needsManualSelection: matchResult.needsManualSelection,
      });
    }

    // TAC cache miss — call imei.info API
    const apiResult = await lookupIMEI(cleaned);

    if (apiResult) {
      const matchResult = await matchToLibrary(
        apiResult.make,
        apiResult.model,
        apiResult.storage
      );

      // Cache the TAC for future lookups
      await adminDb.collection("tacLookup").doc(tac).set({
        make: apiResult.make,
        model: apiResult.model,
        storage: apiResult.storage || null,
        deviceId: matchResult.deviceId,
        source: "imei.info",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        valid: true,
        tac,
        make: apiResult.make,
        model: apiResult.model,
        storage: matchResult.storage,
        deviceId: matchResult.deviceId,
        deviceName: matchResult.deviceName,
        source: "api",
        storageOptions: matchResult.storageOptions,
        needsStorageSelection: matchResult.needsStorageSelection,
        needsManualSelection: matchResult.needsManualSelection,
      });
    }

    // API failed or returned no result
    return NextResponse.json({
      valid: true,
      tac,
      make: null,
      model: null,
      storage: null,
      deviceId: null,
      deviceName: null,
      source: null,
      storageOptions: null,
      needsStorageSelection: false,
      needsManualSelection: true,
    });
  } catch (error) {
    console.error("Error looking up IMEI:", error);
    return NextResponse.json(
      { error: "Failed to lookup IMEI" },
      { status: 500 }
    );
  }
}

// Call imei.info API (v5) to resolve IMEI to device info
async function lookupIMEI(
  imei: string
): Promise<{ make: string; model: string; storage: string | null } | null> {
  const apiKey = process.env.IMEI_API_KEY;

  if (!apiKey) {
    console.warn("IMEI_API_KEY not configured, skipping external lookup");
    return null;
  }

  try {
    // imei.info API v5: GET /api/check/{service_id}/?API_KEY={key}&imei={imei}
    // Service 0 = "Basic IMEI Check" — returns brand_name + model
    const res = await fetch(
      `https://dash.imei.info/api/check/0/?API_KEY=${apiKey}&imei=${imei}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) {
      console.error("imei.info API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();

    // Handle async responses (status 202 / In_progress)
    if (data.status === "In_progress" && data.id) {
      // Poll for result (up to 3 attempts)
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(
          `https://dash.imei.info/api/search_history/${data.id}/?API_KEY=${apiKey}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (pollRes.ok) {
          const pollData = await pollRes.json();
          if (pollData.status === "Done" && pollData.result) {
            return extractDeviceInfo(pollData.result);
          }
        }
      }
      return null;
    }

    if (data.status === "Done" && data.result) {
      return extractDeviceInfo(data.result);
    }

    return null;
  } catch (error) {
    console.error("imei.info API call failed:", error);
    return null;
  }
}

function extractDeviceInfo(
  result: Record<string, unknown>
): { make: string; model: string; storage: string | null } | null {
  const make =
    (result.brand_name as string) ||
    (result.brand as string) ||
    (result.manufacturer as string) ||
    null;
  const model =
    (result.model as string) ||
    (result.model_name as string) ||
    (result.device as string) ||
    null;
  const storage = (result.storage as string) || null;

  if (!make || !model) {
    return null;
  }

  // Normalize make: "APPLE" → "Apple", "SAMSUNG" → "Samsung"
  const normalizedMake =
    make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();

  return { make: normalizedMake, model, storage };
}

// Match API result to our device library
async function matchToLibrary(
  make: string | null,
  model: string | null,
  storage: string | null
): Promise<{
  deviceId: string | null;
  deviceName: string | null;
  storage: string | null;
  storageOptions: string[] | null;
  needsStorageSelection: boolean;
  needsManualSelection: boolean;
}> {
  if (!make || !model) {
    return {
      deviceId: null,
      deviceName: null,
      storage: null,
      storageOptions: null,
      needsStorageSelection: false,
      needsManualSelection: true,
    };
  }

  // Fetch all devices and match in-memory (584 devices is small enough)
  const snapshot = await adminDb.collection("devices").get();
  const devices = snapshot.docs.map((doc) => ({
    id: doc.id,
    make: doc.data().make as string,
    model: doc.data().model as string,
    storage: doc.data().storage as string,
  }));

  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();

  // Strategy 1: If storage is known, try exact match
  if (storage) {
    const normalizedStorage = storage.toLowerCase().replace(/\s/g, "");
    const exactMatch = devices.find(
      (d) =>
        d.make.toLowerCase() === normalizedMake &&
        d.model.toLowerCase() === normalizedModel &&
        d.storage.toLowerCase().replace(/\s/g, "") === normalizedStorage
    );

    if (exactMatch) {
      return {
        deviceId: exactMatch.id,
        deviceName: `${exactMatch.make} ${exactMatch.model} ${exactMatch.storage}`,
        storage: exactMatch.storage,
        storageOptions: null,
        needsStorageSelection: false,
        needsManualSelection: false,
      };
    }
  }

  // Strategy 2: Match make + model, find all storage variants
  const modelMatches = devices.filter((d) => {
    if (d.make.toLowerCase() !== normalizedMake) return false;
    const dModel = d.model.toLowerCase();
    return (
      dModel === normalizedModel ||
      dModel.includes(normalizedModel) ||
      normalizedModel.includes(dModel)
    );
  });

  if (modelMatches.length === 0) {
    // Strategy 3: Fuzzy match — try matching model tokens
    const modelTokens = normalizedModel.split(/[\s\-]+/).filter(Boolean);
    const fuzzyMatches = devices.filter((d) => {
      if (d.make.toLowerCase() !== normalizedMake) return false;
      const dModel = d.model.toLowerCase();
      const matchCount = modelTokens.filter((t) => dModel.includes(t)).length;
      return matchCount / modelTokens.length >= 0.8;
    });

    if (fuzzyMatches.length === 0) {
      return {
        deviceId: null,
        deviceName: null,
        storage: null,
        storageOptions: null,
        needsStorageSelection: false,
        needsManualSelection: true,
      };
    }

    const storageVariants = [
      ...new Set(fuzzyMatches.map((d) => d.storage)),
    ].sort();

    if (fuzzyMatches.length === 1) {
      return {
        deviceId: fuzzyMatches[0].id,
        deviceName: `${fuzzyMatches[0].make} ${fuzzyMatches[0].model} ${fuzzyMatches[0].storage}`,
        storage: fuzzyMatches[0].storage,
        storageOptions: null,
        needsStorageSelection: false,
        needsManualSelection: false,
      };
    }

    return {
      deviceId: null,
      deviceName: `${fuzzyMatches[0].make} ${fuzzyMatches[0].model}`,
      storage: null,
      storageOptions: storageVariants,
      needsStorageSelection: true,
      needsManualSelection: false,
    };
  }

  const storageVariants = [
    ...new Set(modelMatches.map((d) => d.storage)),
  ].sort();

  if (modelMatches.length === 1) {
    return {
      deviceId: modelMatches[0].id,
      deviceName: `${modelMatches[0].make} ${modelMatches[0].model} ${modelMatches[0].storage}`,
      storage: modelMatches[0].storage,
      storageOptions: null,
      needsStorageSelection: false,
      needsManualSelection: false,
    };
  }

  // If storage was provided but didn't exact-match, try closest match
  if (storage) {
    const normalizedStorage = storage.toLowerCase().replace(/\s/g, "");
    const closestMatch = modelMatches.find(
      (d) =>
        d.storage
          .toLowerCase()
          .replace(/\s/g, "")
          .includes(normalizedStorage) ||
        normalizedStorage.includes(d.storage.toLowerCase().replace(/\s/g, ""))
    );
    if (closestMatch) {
      return {
        deviceId: closestMatch.id,
        deviceName: `${closestMatch.make} ${closestMatch.model} ${closestMatch.storage}`,
        storage: closestMatch.storage,
        storageOptions: null,
        needsStorageSelection: false,
        needsManualSelection: false,
      };
    }
  }

  // Multiple storage options — user needs to pick
  return {
    deviceId: null,
    deviceName: `${modelMatches[0].make} ${modelMatches[0].model}`,
    storage: null,
    storageOptions: storageVariants,
    needsStorageSelection: true,
    needsManualSelection: false,
  };
}
