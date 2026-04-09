import { format, isValid, parse } from "date-fns";
import Papa from "papaparse";
import { z } from "zod";
import type { EtsyOrderRow } from "@/types/etsy";

const REQUIRED_HEADERS = [
  "Sale Date",
  "Item Name",
  "Quantity",
  "Price",
  "Listing ID",
  "Ship State",
  "Order ID",
] as const;

const csvRowSchema = z.object({
  "Sale Date": z.string().min(1),
  "Item Name": z.string().min(1),
  Quantity: z.string().min(1),
  Price: z.string().min(1),
  "Listing ID": z.string().min(1),
  "Ship State": z.string().optional().default("Unknown"),
  "Order ID": z.string().min(1),
});

const DATE_FORMATS = ["MMM d, yyyy", "M/d/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"];

function parseSaleDate(value: string): Date {
  for (const pattern of DATE_FORMATS) {
    const parsed = parse(value, pattern, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  const fallback = new Date(value);
  if (isValid(fallback)) {
    return fallback;
  }

  throw new Error(`Invalid sale date: ${value}`);
}

function parseNumber(value: string): number {
  const normalized = value.replace(/[$,\s]/g, "");
  const num = Number(normalized);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return num;
}

export function parseEtsyCsv(csvText: string): EtsyOrderRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`Missing required CSV columns: ${missing.join(", ")}`);
  }

  return parsed.data.map((rawRow) => {
    const row = csvRowSchema.parse(rawRow);
    const date = parseSaleDate(row["Sale Date"]);
    const dayOfMonth = Number(format(date, "dd"));

    return {
      saleDate: format(date, "yyyy-MM-dd"),
      itemName: row["Item Name"].trim(),
      quantity: parseNumber(row.Quantity),
      price: parseNumber(row.Price),
      listingId: row["Listing ID"].trim(),
      shipState: (row["Ship State"] || "Unknown").trim() || "Unknown",
      orderId: row["Order ID"].trim(),
      monthKey: format(date, "yyyy-MM"),
      dayKey: format(date, "yyyy-MM-dd"),
      dayOfMonth,
    };
  });
}
