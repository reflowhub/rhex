/**
 * Generate AI descriptions + features for iPhone devices in the catalog.
 *
 * Usage:
 *   npx tsx scripts/generate-device-descriptions.ts            # write to Firestore
 *   npx tsx scripts/generate-device-descriptions.ts --dry-run   # preview only
 *
 * Requires .env.local with:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 *   ANTHROPIC_API_KEY
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Load env vars from .env.local
// ---------------------------------------------------------------------------
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    let value = trimmed.slice(eqIndex + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
// Initialize Firebase Admin
// ---------------------------------------------------------------------------
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin env vars. Check .env.local");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY. Check .env.local");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();
const dryRun = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Schema for AI-generated content
// ---------------------------------------------------------------------------
const DeviceDescriptionSchema = z.object({
  description: z
    .string()
    .describe("A concise 2-3 sentence product description highlighting what makes this device great"),
  features: z
    .array(z.string())
    .describe("4-6 short feature bullet points covering key specs and selling points"),
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(dryRun ? "DRY RUN — no writes will be made\n" : "");

  // Query all Apple devices
  const snapshot = await db
    .collection("devices")
    .where("make", "==", "Apple")
    .get();

  // Filter to iPhones and group by model
  const modelGroups = new Map<string, { id: string; model: string; storage: string }[]>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const model = data.model as string;
    if (!model.startsWith("iPhone")) continue;

    if (!modelGroups.has(model)) {
      modelGroups.set(model, []);
    }
    modelGroups.get(model)!.push({
      id: doc.id,
      model,
      storage: data.storage as string,
    });
  }

  console.log(`Found ${modelGroups.size} iPhone models across ${snapshot.docs.length} Apple devices\n`);

  let processed = 0;

  for (const [model, devices] of modelGroups) {
    console.log(`Generating for ${model} (${devices.length} variants)...`);

    try {
      const { object } = await generateObject({
        model: anthropic("claude-sonnet-4-20250514"),
        schema: DeviceDescriptionSchema,
        prompt: `Generate a concise 2-3 sentence product description and 4-6 feature bullet points for the Apple ${model}. Focus on key specs and selling points.`,
      });

      console.log(`  Description: ${object.description}`);
      console.log(`  Features:`);
      for (const f of object.features) {
        console.log(`    • ${f}`);
      }

      if (!dryRun) {
        const batch = db.batch();
        for (const device of devices) {
          const ref = db.collection("devices").doc(device.id);
          batch.update(ref, {
            description: object.description,
            features: object.features,
            updatedAt: admin.firestore.Timestamp.now(),
          });
        }
        await batch.commit();
        console.log(`  ✓ Updated ${devices.length} device docs`);
      }

      processed++;
      console.log();
    } catch (err) {
      console.error(`  ✗ Failed for ${model}:`, err);
    }
  }

  console.log(`Done! Processed ${processed}/${modelGroups.size} models.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  });
