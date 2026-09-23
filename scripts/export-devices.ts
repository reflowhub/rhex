#!/usr/bin/env tsx
/**
 * Export all devices from Firestore to CSV for comparison with ETIS
 */

import { loadEnv } from "./load-env";
loadEnv();

import { adminDb } from "@/lib/firebase-admin";
import * as fs from "fs";
import * as path from "path";

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

  // Sort by deviceId (if exists) then by make/model/storage
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

  // Export to CSV
  const csvPath = path.join(process.cwd(), "rhex-devices-export.csv");
  const header = "DeviceID,Make,Model,Storage,ModelStorage,Category,Active,FirestoreDocId\n";
  const rows = devices.map((d) => {
    return `${d.deviceId ?? ""},${d.make},${d.model},${d.storage},"${d.modelStorage ?? ""}",${d.category},${d.active},${d.id}`;
  }).join("\n");

  fs.writeFileSync(csvPath, header + rows, "utf-8");
  console.log(`Exported to: ${csvPath}`);

  // Summary stats
  const withDeviceId = devices.filter((d) => d.deviceId).length;
  const withoutDeviceId = devices.length - withDeviceId;
  const activeCount = devices.filter((d) => d.active).length;

  console.log("\nSummary:");
  console.log(`  Total devices: ${devices.length}`);
  console.log(`  With numeric deviceId: ${withDeviceId}`);
  console.log(`  Without deviceId: ${withoutDeviceId}`);
  console.log(`  Active: ${activeCount}`);
  console.log(`  Inactive: ${devices.length - activeCount}`);

  // Category breakdown
  const categories = new Map<string, number>();
  devices.forEach((d) => {
    categories.set(d.category, (categories.get(d.category) ?? 0) + 1);
  });
  console.log("\nBy category:");
  for (const [cat, count] of categories.entries()) {
    console.log(`  ${cat}: ${count}`);
  }
}

exportDevices().catch(console.error);
