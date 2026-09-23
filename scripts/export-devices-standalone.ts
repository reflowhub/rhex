#!/usr/bin/env tsx
/**
 * Standalone device export script - loads env first, then Firebase
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

// Load .env.local BEFORE importing Firebase
const envPath = resolve(process.cwd(), '.env.local');
const envFile = readFileSync(envPath, 'utf-8');

envFile.split('\n').forEach(line => {
  if (line.trim().startsWith('#') || !line.trim()) return;
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
});

console.log('Environment loaded');

// NOW import Firebase
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const adminDb = admin.firestore();

console.log('Firebase initialized');

interface Device {
  id: string;
  deviceId?: number;
  make: string;
  model: string;
  storage: string;
  modelStorage?: string;
  category: string;
  active: boolean;
}

async function exportDevices() {
  console.log("Fetching devices from Firestore...");

  const snapshot = await adminDb.collection("devices").get();
  const devices: Device[] = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    devices.push({
      id: doc.id,
      deviceId: data.deviceId as number | undefined,
      make: data.make as string,
      model: data.model as string,
      storage: data.storage as string,
      modelStorage: data.modelStorage as string | undefined,
      category: (data.category as string) ?? "Phone",
      active: data.active !== false,
    });
  });

  console.log(`Found ${devices.length} devices`);

  // Sort by deviceId
  devices.sort((a, b) => {
    if (a.deviceId && b.deviceId) {
      return a.deviceId - b.deviceId;
    }
    if (a.deviceId) return -1;
    if (b.deviceId) return 1;
    return `${a.make}|${a.model}|${a.storage}`.localeCompare(
      `${b.make}|${b.model}|${b.storage}`
    );
  });

  // Export to CSV in project root
  const csvPath = join(process.cwd(), "rhex-devices-export.csv");
  const header = "DeviceID,Make,Model,Storage,ModelStorage,Category,Active,FirestoreDocId\n";
  const rows = devices.map((d) => {
    return `${d.deviceId ?? ""},${d.make},${d.model},${d.storage},"${d.modelStorage ?? ""}",${d.category},${d.active},${d.id}`;
  }).join("\n");

  writeFileSync(csvPath, header + rows, "utf-8");
  console.log(`\nExported to: ${csvPath}`);

  // Summary stats
  const withDeviceId = devices.filter((d) => d.deviceId).length;
  const withoutDeviceId = devices.length - withDeviceId;
  const activeCount = devices.filter((d) => d.active).length;

  console.log("\n=== SUMMARY ===");
  console.log(`Total devices: ${devices.length}`);
  console.log(`With numeric deviceId: ${withDeviceId}`);
  console.log(`Without deviceId: ${withoutDeviceId}`);
  console.log(`Active: ${activeCount}`);
  console.log(`Inactive: ${devices.length - activeCount}`);

  // Category breakdown
  const categories = new Map<string, number>();
  devices.forEach((d) => {
    categories.set(d.category, (categories.get(d.category) ?? 0) + 1);
  });
  console.log("\n=== BY CATEGORY ===");
  for (const [cat, count] of categories.entries()) {
    console.log(`${cat}: ${count}`);
  }

  // DeviceID statistics
  if (withDeviceId > 0) {
    const deviceIds = devices.filter(d => d.deviceId).map(d => d.deviceId!);
    const minId = Math.min(...deviceIds);
    const maxId = Math.max(...deviceIds);
    console.log("\n=== DEVICE ID RANGE ===");
    console.log(`Min deviceId: ${minId}`);
    console.log(`Max deviceId: ${maxId}`);
  }

  process.exit(0);
}

exportDevices().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
