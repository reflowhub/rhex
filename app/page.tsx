"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

export default function Home() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedStorage, setSelectedStorage] = useState("");

  // Fetch all devices on mount
  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch("/api/devices");
        if (res.ok) {
          const data = await res.json();
          setDevices(data);
        }
      } catch (error) {
        console.error("Failed to fetch devices:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDevices();
  }, []);

  // Derive unique makes
  const makes = useMemo(() => {
    const unique = [...new Set(devices.map((d) => d.make))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [devices]);

  // Derive models filtered by selected make
  const models = useMemo(() => {
    if (!selectedMake) return [];
    const filtered = devices.filter((d) => d.make === selectedMake);
    const unique = [...new Set(filtered.map((d) => d.model))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [devices, selectedMake]);

  // Derive storage options filtered by selected make + model
  const storageOptions = useMemo(() => {
    if (!selectedMake || !selectedModel) return [];
    const filtered = devices.filter(
      (d) => d.make === selectedMake && d.model === selectedModel
    );
    const unique = [...new Set(filtered.map((d) => d.storage))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [devices, selectedMake, selectedModel]);

  // Find the selected device ID
  const selectedDeviceId = useMemo(() => {
    if (!selectedMake || !selectedModel || !selectedStorage) return null;
    const device = devices.find(
      (d) =>
        d.make === selectedMake &&
        d.model === selectedModel &&
        d.storage === selectedStorage
    );
    return device?.id ?? null;
  }, [devices, selectedMake, selectedModel, selectedStorage]);

  const handleMakeChange = (value: string) => {
    setSelectedMake(value);
    setSelectedModel("");
    setSelectedStorage("");
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    setSelectedStorage("");
  };

  const handleStorageChange = (value: string) => {
    setSelectedStorage(value);
  };

  const handleGetQuote = () => {
    if (selectedDeviceId) {
      router.push(`/quote?device=${selectedDeviceId}`);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-primary">rhex</span>{" "}
              <span className="text-muted-foreground font-normal">
                Trade-In
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:py-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Trade in your phone{" "}
            <span className="text-primary">for cash</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Get an instant quote for your device. Fast, free, and fair.
          </p>
        </div>

        {/* Device Selection Card */}
        <div className="mx-auto mt-12 max-w-lg">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Find your device</h2>
            </div>

            <div className="space-y-4">
              {/* Make Select */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Brand
                </label>
                <Select
                  value={selectedMake}
                  onValueChange={handleMakeChange}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={loading ? "Loading..." : "Select brand"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {makes.map((make) => (
                      <SelectItem key={make} value={make}>
                        {make}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Select */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Model
                </label>
                <Select
                  value={selectedModel}
                  onValueChange={handleModelChange}
                  disabled={!selectedMake || models.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Storage Select */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Storage
                </label>
                <Select
                  value={selectedStorage}
                  onValueChange={handleStorageChange}
                  disabled={!selectedModel || storageOptions.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select storage" />
                  </SelectTrigger>
                  <SelectContent>
                    {storageOptions.map((storage) => (
                      <SelectItem key={storage} value={storage}>
                        {storage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Get Quote Button */}
              <Button
                onClick={handleGetQuote}
                disabled={!selectedDeviceId}
                className="w-full mt-2"
                size="lg"
              >
                Get Quote
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* IMEI Option */}
            <div className="mt-6 flex items-center justify-center gap-2 border-t pt-4">
              <span className="text-sm text-muted-foreground">
                I have an IMEI
              </span>
              <Badge variant="secondary" className="text-xs">
                Coming soon
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t bg-card py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Select your device",
                description:
                  "Choose your phone brand, model, and storage capacity.",
              },
              {
                step: "2",
                title: "Grade your device",
                description:
                  "Answer a few quick questions about your device condition.",
              },
              {
                step: "3",
                title: "Get paid",
                description:
                  "Accept your quote, ship your device, and receive payment.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div
                  className={cn(
                    "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                    "bg-primary text-primary-foreground text-lg font-bold"
                  )}
                >
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
          <p>rhex Trade-In Program</p>
        </div>
      </footer>
    </main>
  );
}
