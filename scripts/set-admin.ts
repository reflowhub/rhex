/**
 * Set up an admin user with Firebase Auth custom claims.
 *
 * Usage:
 *   npx tsx scripts/set-admin.ts <email> <password>
 *
 * If the user already exists, updates their custom claims.
 * If the user doesn't exist, creates the account and sets claims.
 *
 * Requires .env.local with:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Load env vars from .env.local (same pattern as seed.ts — no dotenv dependency)
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

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin environment variables in .env.local");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/set-admin.ts <email> <password>");
    process.exit(1);
  }

  let uid: string;

  try {
    // Try to find existing user
    const existingUser = await admin.auth().getUserByEmail(email);
    uid = existingUser.uid;
    console.log(`Found existing user: ${uid}`);
  } catch {
    // User doesn't exist — create them
    const newUser = await admin.auth().createUser({ email, password });
    uid = newUser.uid;
    console.log(`Created new user: ${uid}`);
  }

  // Set admin custom claim
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log(`Set admin claim for ${email} (uid: ${uid})`);
  console.log("Done. You can now log in at /admin/login");

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
