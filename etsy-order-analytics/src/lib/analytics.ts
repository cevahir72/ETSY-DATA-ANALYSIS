import { format } from "date-fns";
import type {
  AnalyticsPayload,
  DailySales,
  EtsyOrderRow,
  ListingSummary,
  ProductShare,
  StateRanking,
} from "@/types/etsy";

function getDaysInMonth(monthKey: string): string[] {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!year || !month) {
    return [];
  }

  const totalDays = new Date(year, month, 0).getDate();
  return Array.from({ length: totalDays }, (_, idx) => {
    const day = String(idx + 1).padStart(2, "0");
    return `${monthKey}-${day}`;
  });
}

export function buildAnalytics(
  rows: EtsyOrderRow[],
  month: string,
  requestedListingId?: string,
): AnalyticsPayload {
  const listingMap = new Map<string, ListingSummary>();
  const productMap = new Map<string, number>();
  const stateMap = new Map<string, { quantity: number; orderIds: Set<string> }>();

  let totalQuantity = 0;

  for (const row of rows) {
    totalQuantity += row.quantity;

    const listingCurrent = listingMap.get(row.listingId);
    if (listingCurrent) {
      listingCurrent.quantity += row.quantity;
    } else {
      listingMap.set(row.listingId, {
        listingId: row.listingId,
        itemName: row.itemName,
        quantity: row.quantity,
      });
    }

    productMap.set(row.itemName, (productMap.get(row.itemName) ?? 0) + row.quantity);

    const stateKey = row.shipState || "Unknown";
    const stateCurrent = stateMap.get(stateKey);
    if (stateCurrent) {
      stateCurrent.quantity += row.quantity;
      stateCurrent.orderIds.add(row.orderId);
    } else {
      stateMap.set(stateKey, {
        quantity: row.quantity,
        orderIds: new Set([row.orderId]),
      });
    }
  }

  const listingSummary = [...listingMap.values()].sort((a, b) => b.quantity - a.quantity);

  const productShare: ProductShare[] = [...productMap.entries()]
    .map(([itemName, quantity]) => ({
      itemName,
      quantity,
      percentage: totalQuantity === 0 ? 0 : Number(((quantity / totalQuantity) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.quantity - a.quantity);

  const stateRanking: StateRanking[] = [...stateMap.entries()]
    .map(([shipState, value]) => ({
      shipState,
      quantity: value.quantity,
      orderCount: value.orderIds.size,
    }))
    .sort((a, b) => b.quantity - a.quantity);

  const selectedListingId =
    requestedListingId && listingMap.has(requestedListingId)
      ? requestedListingId
      : (listingSummary[0]?.listingId ?? "");

  const dailyAccumulator = new Map<string, number>();
  for (const row of rows) {
    if (row.listingId !== selectedListingId) {
      continue;
    }

    dailyAccumulator.set(row.dayKey, (dailyAccumulator.get(row.dayKey) ?? 0) + row.quantity);
  }

  const listingDaily: DailySales[] = getDaysInMonth(month).map((day) => ({
    day: format(new Date(`${day}T00:00:00`), "dd MMM"),
    quantity: dailyAccumulator.get(day) ?? 0,
  }));

  return {
    month,
    rowCount: rows.length,
    totalQuantity,
    selectedListingId,
    listingSummary,
    productShare,
    stateRanking,
    listingDaily,
  };
}
