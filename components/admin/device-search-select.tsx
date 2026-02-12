"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectedDevice {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface DeviceSearchSelectProps {
  value: SelectedDevice | null;
  onChange: (device: SelectedDevice | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeviceSearchSelect({
  value,
  onChange,
}: DeviceSearchSelectProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch devices
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    fetch(
      `/api/admin/devices?search=${encodeURIComponent(debouncedSearch)}`
    )
      .then((res) => res.json())
      .then((data: Device[]) => {
        if (Array.isArray(data)) {
          setResults(data.slice(0, 20));
        }
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (device: Device) => {
    onChange({
      id: device.id,
      make: device.make,
      model: device.model,
      storage: device.storage,
    });
    setSearchInput("");
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearchInput("");
    setResults([]);
  };

  // If a device is selected, show the selection
  if (value) {
    return (
      <div className="grid gap-2">
        <Label>Device *</Label>
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
          <span className="flex-1 text-sm font-medium">
            {value.make} {value.model} {value.storage}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2" ref={containerRef}>
      <Label>Device *</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search devices by make, model, storage..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results dropdown */}
      {open && debouncedSearch.length >= 2 && !loading && (
        <div className="absolute z-50 mt-[4.5rem] w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No devices found.
            </div>
          ) : (
            <ul>
              {results.map((device) => (
                <li key={device.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => handleSelect(device)}
                  >
                    <span className="font-medium">{device.make}</span>
                    <span>{device.model}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {device.storage}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
