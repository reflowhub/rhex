import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { getDevices, type CachedDevice } from "@/lib/device-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LibraryDevice {
  id: string;
  make: string;
  model: string;
  storage: string;
  active: boolean;
  category: string;
}

export interface MatchResult {
  deviceId: string | null;
  deviceName: string | null;
  storage: string | null;
  matchConfidence: "high" | "medium" | "low";
  storageOptions: string[] | null;
  needsStorageSelection: boolean;
  needsManualSelection: boolean;
}

// ---------------------------------------------------------------------------
// Brand aliases for parsing raw strings
// ---------------------------------------------------------------------------

const BRAND_ALIASES: Record<string, string[]> = {
  Apple: ["apple", "iphone", "iph", "ip"],
  Samsung: ["samsung", "galaxy", "sam", "sm"],
  Google: ["google", "pixel"],
  OPPO: ["oppo"],
  Xiaomi: ["xiaomi", "redmi", "poco"],
  Huawei: ["huawei", "honor"],
  OnePlus: ["oneplus", "one plus"],
  Motorola: ["motorola", "moto"],
  Nokia: ["nokia"],
  Sony: ["sony", "xperia"],
  Vivo: ["vivo"],
  Realme: ["realme"],
};

// ---------------------------------------------------------------------------
// Device library loader (backed by shared cache in device-cache.ts)
// ---------------------------------------------------------------------------

export async function loadDeviceLibrary(): Promise<LibraryDevice[]> {
  return getDevices();
}

// ---------------------------------------------------------------------------
// Match from structured fields (make/model/storage) — used by IMEI lookup
// ---------------------------------------------------------------------------

export async function matchToLibrary(
  make: string | null,
  model: string | null,
  storage: string | null,
  category?: string
): Promise<MatchResult> {
  if (!make || !model) {
    return {
      deviceId: null,
      deviceName: null,
      storage: null,
      matchConfidence: "low",
      storageOptions: null,
      needsStorageSelection: false,
      needsManualSelection: true,
    };
  }

  const allDevices = await loadDeviceLibrary();
  let devices = allDevices.filter((d) => d.active);
  if (category) {
    devices = devices.filter((d) => d.category === category);
  }
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
        matchConfidence: "high",
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
        matchConfidence: "low",
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
        matchConfidence: "medium",
        storageOptions: null,
        needsStorageSelection: false,
        needsManualSelection: false,
      };
    }

    return {
      deviceId: null,
      deviceName: `${fuzzyMatches[0].make} ${fuzzyMatches[0].model}`,
      storage: null,
      matchConfidence: "medium",
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
      matchConfidence: "high",
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
        matchConfidence: "high",
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
    matchConfidence: "medium",
    storageOptions: storageVariants,
    needsStorageSelection: true,
    needsManualSelection: false,
  };
}

// ---------------------------------------------------------------------------
// Parse raw device string (e.g. "IPH1164G", "iPhone 11 64GB")
// ---------------------------------------------------------------------------

function extractBrand(input: string): { brand: string | null; rest: string } {
  const lower = input.toLowerCase();
  for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
    for (const alias of aliases) {
      if (lower.startsWith(alias)) {
        return { brand, rest: input.slice(alias.length).trim() };
      }
      // Also check if alias appears as a word boundary match
      const pattern = new RegExp(`\\b${alias}\\b`, "i");
      if (pattern.test(lower)) {
        return { brand, rest: lower.replace(pattern, "").trim() };
      }
    }
  }
  return { brand: null, rest: input };
}

function extractStorage(input: string): {
  storage: string | null;
  rest: string;
} {
  const match = input.match(/(\d+)\s*(?:gb|tb)/i);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[0].toLowerCase().includes("tb") ? "TB" : "GB";
    const storage = `${num}${unit}`;
    const rest = input.replace(match[0], "").trim();
    return { storage, rest };
  }
  return { storage: null, rest: input };
}

// ---------------------------------------------------------------------------
// Match from raw device string — used by manifest import
// Checks alias table first, then parses and fuzzy matches
// ---------------------------------------------------------------------------

export async function matchDeviceString(
  rawInput: string,
  category?: string
): Promise<MatchResult> {
  if (!rawInput || !rawInput.trim()) {
    return {
      deviceId: null,
      deviceName: null,
      storage: null,
      matchConfidence: "low",
      storageOptions: null,
      needsStorageSelection: false,
      needsManualSelection: true,
    };
  }

  const normalized = rawInput.trim();

  // Step 1: Check alias table
  const aliasSnapshot = await adminDb
    .collection("deviceAliases")
    .where("alias", "==", normalized.toLowerCase())
    .limit(1)
    .get();

  if (!aliasSnapshot.empty) {
    const alias = aliasSnapshot.docs[0].data();
    if (alias.deviceId) {
      const deviceDoc = await adminDb
        .collection("devices")
        .doc(alias.deviceId)
        .get();
      if (deviceDoc.exists) {
        const device = deviceDoc.data()!;
        return {
          deviceId: alias.deviceId,
          deviceName: `${device.make} ${device.model} ${device.storage}`,
          storage: device.storage as string,
          matchConfidence: "high",
          storageOptions: null,
          needsStorageSelection: false,
          needsManualSelection: false,
        };
      }
    }
  }

  // Step 2: Parse the raw string
  const { brand, rest: afterBrand } = extractBrand(normalized);
  const { storage, rest: afterStorage } = extractStorage(afterBrand);

  // Clean up remaining text as model tokens
  const modelText = afterStorage
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Step 3: Try structured matching if we got a brand
  if (brand && modelText) {
    const result = await matchToLibrary(brand, modelText, storage, category);
    return result;
  }

  // Step 4: Try matching the full string against the entire device library
  const allDevicesForString = await loadDeviceLibrary();
  let devices = allDevicesForString.filter((d) => d.active);
  if (category) {
    devices = devices.filter((d) => d.category === category);
  }
  const lowerInput = normalized.toLowerCase().replace(/[^\w\s]/g, " ");

  // Try exact modelStorage match
  const exactMatch = devices.find(
    (d) =>
      `${d.make} ${d.model} ${d.storage}`.toLowerCase() === lowerInput ||
      `${d.model} ${d.storage}`.toLowerCase() === lowerInput
  );

  if (exactMatch) {
    return {
      deviceId: exactMatch.id,
      deviceName: `${exactMatch.make} ${exactMatch.model} ${exactMatch.storage}`,
      storage: exactMatch.storage,
      matchConfidence: "high",
      storageOptions: null,
      needsStorageSelection: false,
      needsManualSelection: false,
    };
  }

  // Try token-based matching across all fields
  const inputTokens = lowerInput.split(/\s+/).filter(Boolean);
  if (inputTokens.length === 0) {
    return {
      deviceId: null,
      deviceName: null,
      storage: null,
      matchConfidence: "low",
      storageOptions: null,
      needsStorageSelection: false,
      needsManualSelection: true,
    };
  }

  const scored = devices
    .map((d) => {
      const deviceStr =
        `${d.make} ${d.model} ${d.storage}`.toLowerCase();
      const matchCount = inputTokens.filter((t) =>
        deviceStr.includes(t)
      ).length;
      const score = matchCount / inputTokens.length;
      return { device: d, score };
    })
    .filter((s) => s.score >= 0.6)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      deviceId: null,
      deviceName: null,
      storage: null,
      matchConfidence: "low",
      storageOptions: null,
      needsStorageSelection: false,
      needsManualSelection: true,
    };
  }

  // Check if top matches are same model with different storage
  const topScore = scored[0].score;
  const topMatches = scored.filter((s) => s.score === topScore);

  if (topMatches.length === 1) {
    const confidence = topScore >= 0.8 ? "medium" : "low";
    return {
      deviceId: topMatches[0].device.id,
      deviceName: `${topMatches[0].device.make} ${topMatches[0].device.model} ${topMatches[0].device.storage}`,
      storage: topMatches[0].device.storage,
      matchConfidence: confidence,
      storageOptions: null,
      needsStorageSelection: false,
      needsManualSelection: confidence === "low",
    };
  }

  // Multiple matches at the same score — likely storage variants
  const confidence = topScore >= 0.8 ? "medium" : "low";
  const storageOptions = [...new Set(topMatches.map((m) => m.device.storage))].sort();
  if (storageOptions.length > 1) {
    return {
      deviceId: null,
      deviceName: `${topMatches[0].device.make} ${topMatches[0].device.model}`,
      storage: null,
      matchConfidence: confidence,
      storageOptions,
      needsStorageSelection: true,
      needsManualSelection: false,
    };
  }

  return {
    deviceId: topMatches[0].device.id,
    deviceName: `${topMatches[0].device.make} ${topMatches[0].device.model} ${topMatches[0].device.storage}`,
    storage: topMatches[0].device.storage,
    matchConfidence: confidence,
    storageOptions: null,
    needsStorageSelection: false,
    needsManualSelection: confidence === "low",
  };
}

// ---------------------------------------------------------------------------
// Alias management
// ---------------------------------------------------------------------------

export async function saveAlias(
  alias: string,
  deviceId: string,
  createdBy: string = "auto"
): Promise<void> {
  const normalized = alias.trim().toLowerCase();
  if (!normalized) return;

  // Check if alias already exists
  const existing = await adminDb
    .collection("deviceAliases")
    .where("alias", "==", normalized)
    .limit(1)
    .get();

  if (!existing.empty) {
    // Update existing alias
    await existing.docs[0].ref.update({
      deviceId,
      createdBy,
    });
  } else {
    // Create new alias
    await adminDb.collection("deviceAliases").add({
      alias: normalized,
      deviceId,
      createdBy,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
