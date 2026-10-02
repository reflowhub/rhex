"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AU_STATES, type AuAddressInput } from "@/lib/au-address";

/**
 * Australian address fields (street, unit, suburb, state, postcode) for
 * trade-in acceptance. Uses browser autofill tokens, and a native select for
 * the state so autofill can fill it.
 */
export default function AuAddressFields({
  value,
  onChange,
  idPrefix,
  label = "Shipping Address",
  hint,
}: {
  value: AuAddressInput;
  onChange: (value: AuAddressInput) => void;
  /** Keeps ids unique when the form appears more than once on a page */
  idPrefix: string;
  label?: string;
  hint?: string;
}) {
  const set = (field: keyof AuAddressInput) => (v: string) =>
    onChange({ ...value, [field]: v });
  const id = (field: string) => `${idPrefix}-${field}`;
  const postcodeInvalid = value.postcode !== "" && !/^\d{4}$/.test(value.postcode);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium leading-none">{label}</legend>

      <div>
        <Label htmlFor={id("line1")} className="text-xs text-muted-foreground">
          Street address
        </Label>
        <Input
          id={id("line1")}
          autoComplete="address-line1"
          value={value.line1}
          onChange={(e) => set("line1")(e.target.value)}
          placeholder="12 Smith St"
          required
          maxLength={100}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor={id("line2")} className="text-xs text-muted-foreground">
          Apartment, unit or level (optional)
        </Label>
        <Input
          id={id("line2")}
          autoComplete="address-line2"
          value={value.line2}
          onChange={(e) => set("line2")(e.target.value)}
          placeholder="Unit 2"
          maxLength={100}
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_6.5rem_6rem]">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor={id("suburb")} className="text-xs text-muted-foreground">
            Suburb
          </Label>
          <Input
            id={id("suburb")}
            autoComplete="address-level2"
            value={value.suburb}
            onChange={(e) => set("suburb")(e.target.value)}
            placeholder="Sydney"
            required
            maxLength={100}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={id("state")} className="text-xs text-muted-foreground">
            State
          </Label>
          <select
            id={id("state")}
            autoComplete="address-level1"
            value={value.state}
            onChange={(e) => set("state")(e.target.value)}
            required
            className={cn(
              "mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm",
              value.state === "" && "text-muted-foreground"
            )}
          >
            <option value="" disabled>
              State
            </option>
            {AU_STATES.map((s) => (
              <option key={s} value={s} className="text-foreground">
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={id("postcode")} className="text-xs text-muted-foreground">
            Postcode
          </Label>
          <Input
            id={id("postcode")}
            autoComplete="postal-code"
            inputMode="numeric"
            value={value.postcode}
            onChange={(e) => set("postcode")(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="2000"
            required
            maxLength={4}
            className="mt-1"
            aria-invalid={postcodeInvalid || undefined}
          />
        </div>
      </div>

      {postcodeInvalid && (
        <p className="text-xs text-amber-600">Postcode must be 4 digits</p>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </fieldset>
  );
}
