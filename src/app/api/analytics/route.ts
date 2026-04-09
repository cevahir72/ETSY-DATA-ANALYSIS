import { buildAnalytics } from "@/lib/analytics";
import { readMonthRows } from "@/lib/sheets";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const month = url.searchParams.get("month")?.trim();
    const listingId = url.searchParams.get("listingId")?.trim();

    if (!month) {
      return Response.json({ error: "month parametresi gerekli." }, { status: 400 });
    }

    const rows = await readMonthRows(month);
    const analytics = buildAnalytics(rows, month, listingId);

    return Response.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analytics okunamadı.";
    return Response.json({ error: message }, { status: 500 });
  }
}
