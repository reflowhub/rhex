/**
 * One-time migration: seeds the settings/categories document into an existing
 * Firestore database. Safe to run multiple times (overwrites the document).
 *
 * Usage:
 *   npx tsx scripts/seed-categories.ts
 *
 * Requires .env.local with:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Load env vars from .env.local
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

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin env vars. Check .env.local");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();

async function seedCategories() {
  await db.collection("settings").doc("categories").set({
    Phone: {
      grades: [
        { key: "A", label: "Excellent" },
        { key: "B", label: "Good" },
        { key: "C", label: "Fair" },
        { key: "D", label: "Screen Issues" },
        { key: "E", label: "No Power" },
      ],
    },
  });
  console.log("settings/categories document written successfully");
}

seedCategories()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to seed categories:", err);
    process.exit(1);
  });
