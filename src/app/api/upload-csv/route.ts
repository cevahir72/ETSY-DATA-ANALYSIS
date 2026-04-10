import { parseEtsyCsv } from "@/lib/etsy";
import { overwriteMonthRows, readMonthAnalytics } from "@/lib/sheets";
import type { EtsyOrderRow } from "@/types/etsy";

function overrideMonth(rows: EtsyOrderRow[], month: string): EtsyOrderRow[] {
  return rows.map((row) => {
    const day = String(row.dayOfMonth).padStart(2, "0");
    return {
      ...row,
      monthKey: month,
      dayKey: `${month}-${day}`,
    };
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const selectedMonth = String(formData.get("month") || "").trim();

    if (!(file instanceof File)) {
      return Response.json({ error: "CSV file is required." }, { status: 400 });
    }

    const csvText = await file.text();
    let rows = parseEtsyCsv(csvText);

    if (selectedMonth) {
      rows = overrideMonth(rows, selectedMonth);
    }

    const rowsByMonth = rows.reduce<Record<string, EtsyOrderRow[]>>((acc, row) => {
      acc[row.monthKey] ??= [];
      acc[row.monthKey].push(row);
      return acc;
    }, {});

    const uploadedMonths: { month: string; rowCount: number }[] = [];

    for (const [month, monthRows] of Object.entries(rowsByMonth)) {
      await overwriteMonthRows(month, monthRows);
      uploadedMonths.push({ month, rowCount: monthRows.length });
    }

    const primaryMonth = selectedMonth || uploadedMonths[0]?.month || rows[0]?.monthKey || "";
    const analytics = primaryMonth ? await readMonthAnalytics(primaryMonth) : null;

    return Response.json({
      message: "CSV uploaded successfully.",
      uploadedMonths,
      analytics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
