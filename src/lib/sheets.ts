import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import type { AnalyticsPayload, DailySales, EtsyOrderRow } from "@/types/etsy";

declare global {
  var etsyPgPool: Pool | undefined;
}

function getPool(): Pool {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL or DATABASE_URL is not configured.");
  }

  if (!global.etsyPgPool) {
    global.etsyPgPool = new Pool({ connectionString });
  }

  return global.etsyPgPool;
}

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

async function ensureSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS etsy_orders (
      id BIGSERIAL PRIMARY KEY,
      sale_date DATE NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price NUMERIC(12,2) NOT NULL,
      listing_id TEXT NOT NULL,
      ship_state TEXT NOT NULL,
      order_id TEXT NOT NULL,
      month_key CHAR(7) NOT NULL,
      day_key DATE NOT NULL,
      day_of_month SMALLINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query("CREATE INDEX IF NOT EXISTS idx_etsy_orders_month_key ON etsy_orders (month_key)");
  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_etsy_orders_month_listing ON etsy_orders (month_key, listing_id)",
  );
  await client.query(
    `
      CREATE UNIQUE INDEX IF NOT EXISTS ux_etsy_orders_month_order_listing_item_day
      ON etsy_orders (month_key, order_id, listing_id, item_name, day_key)
    `,
  );
}

export async function overwriteMonthRows(monthKey: string, rows: EtsyOrderRow[]) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureSchema(client);

    if (rows.length === 0) {
      await client.query("DELETE FROM etsy_orders WHERE month_key = $1", [monthKey]);
      await client.query("COMMIT");
      return;
    }

    const saleDateArray: string[] = [];
    const itemNameArray: string[] = [];
    const quantityArray: number[] = [];
    const priceArray: number[] = [];
    const listingIdArray: string[] = [];
    const shipStateArray: string[] = [];
    const orderIdArray: string[] = [];
    const monthKeyArray: string[] = [];
    const dayKeyArray: string[] = [];
    const dayOfMonthArray: number[] = [];

    for (const row of rows) {
      saleDateArray.push(row.saleDate);
      itemNameArray.push(row.itemName);
      quantityArray.push(row.quantity);
      priceArray.push(row.price);
      listingIdArray.push(row.listingId);
      shipStateArray.push(row.shipState);
      orderIdArray.push(row.orderId);
      monthKeyArray.push(row.monthKey);
      dayKeyArray.push(row.dayKey);
      dayOfMonthArray.push(row.dayOfMonth);
    }

    await client.query(`
      CREATE TEMP TABLE tmp_etsy_orders_upload (
        sale_date DATE NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price NUMERIC(12,2) NOT NULL,
        listing_id TEXT NOT NULL,
        ship_state TEXT NOT NULL,
        order_id TEXT NOT NULL,
        month_key CHAR(7) NOT NULL,
        day_key DATE NOT NULL,
        day_of_month SMALLINT NOT NULL
      ) ON COMMIT DROP
    `);

    await client.query(
      `
        INSERT INTO tmp_etsy_orders_upload (
          sale_date, item_name, quantity, price, listing_id,
          ship_state, order_id, month_key, day_key, day_of_month
        )
        SELECT * FROM UNNEST(
          $1::date[],
          $2::text[],
          $3::int[],
          $4::numeric[],
          $5::text[],
          $6::text[],
          $7::text[],
          $8::char(7)[],
          $9::date[],
          $10::smallint[]
        )
      `,
      [
        saleDateArray,
        itemNameArray,
        quantityArray,
        priceArray,
        listingIdArray,
        shipStateArray,
        orderIdArray,
        monthKeyArray,
        dayKeyArray,
        dayOfMonthArray,
      ],
    );

    await client.query(
      `
        WITH deduped AS (
          SELECT DISTINCT ON (month_key, order_id, listing_id, item_name, day_key)
            sale_date,
            item_name,
            quantity,
            price,
            listing_id,
            ship_state,
            order_id,
            month_key,
            day_key,
            day_of_month
          FROM tmp_etsy_orders_upload
          ORDER BY
            month_key,
            order_id,
            listing_id,
            item_name,
            day_key,
            sale_date DESC,
            quantity DESC
        )
        INSERT INTO etsy_orders (
          sale_date, item_name, quantity, price, listing_id,
          ship_state, order_id, month_key, day_key, day_of_month
        )
        SELECT
          sale_date, item_name, quantity, price, listing_id,
          ship_state, order_id, month_key, day_key, day_of_month
        FROM deduped
        ON CONFLICT (month_key, order_id, listing_id, item_name, day_key)
        DO UPDATE SET
          sale_date = EXCLUDED.sale_date,
          quantity = EXCLUDED.quantity,
          price = EXCLUDED.price,
          ship_state = EXCLUDED.ship_state,
          day_of_month = EXCLUDED.day_of_month
      `,
    );

    await client.query(
      `
        DELETE FROM etsy_orders t
        WHERE t.month_key = $1
          AND NOT EXISTS (
            SELECT 1
            FROM tmp_etsy_orders_upload s
            WHERE s.month_key = t.month_key
              AND s.order_id = t.order_id
              AND s.listing_id = t.listing_id
              AND s.item_name = t.item_name
              AND s.day_key = t.day_key
          )
      `,
      [monthKey],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function readMonthRows(monthKey: string): Promise<EtsyOrderRow[]> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await ensureSchema(client);
    const result = await client.query<{
      sale_date: string;
      item_name: string;
      quantity: number;
      price: string;
      listing_id: string;
      ship_state: string;
      order_id: string;
      month_key: string;
      day_key: string;
      day_of_month: number;
    }>(
      `
        SELECT
          sale_date,
          item_name,
          quantity,
          price,
          listing_id,
          ship_state,
          order_id,
          month_key,
          day_key,
          day_of_month
        FROM etsy_orders
        WHERE month_key = $1
        ORDER BY day_key ASC, id ASC
      `,
      [monthKey],
    );

    return result.rows.map((row) => ({
      saleDate: row.sale_date,
      itemName: row.item_name,
      quantity: Number(row.quantity),
      price: Number(row.price),
      listingId: row.listing_id,
      shipState: row.ship_state,
      orderId: row.order_id,
      monthKey: row.month_key,
      dayKey: row.day_key,
      dayOfMonth: Number(row.day_of_month),
    }));
  } finally {
    client.release();
  }
}

export async function readMonthAnalytics(
  monthKey: string,
  requestedListingId?: string,
): Promise<AnalyticsPayload> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await ensureSchema(client);

    const totalsResult = await client.query<{ row_count: string; total_quantity: string }>(
      `
        SELECT
          COUNT(*)::int::text AS row_count,
          COALESCE(SUM(quantity), 0)::int::text AS total_quantity
        FROM etsy_orders
        WHERE month_key = $1
      `,
      [monthKey],
    );

    const listingSummaryResult = await client.query<{
      listing_id: string;
      item_name: string;
      quantity: string;
    }>(
      `
        SELECT
          listing_id,
          MIN(item_name) AS item_name,
          SUM(quantity)::int::text AS quantity
        FROM etsy_orders
        WHERE month_key = $1
        GROUP BY listing_id
        ORDER BY SUM(quantity) DESC
      `,
      [monthKey],
    );

    const rowCount = Number(totalsResult.rows[0]?.row_count ?? "0");
    const totalQuantity = Number(totalsResult.rows[0]?.total_quantity ?? "0");

    const listingSummary = listingSummaryResult.rows.map((row) => ({
      listingId: row.listing_id,
      itemName: row.item_name,
      quantity: Number(row.quantity),
    }));

    const selectedListingId =
      requestedListingId && listingSummary.some((row) => row.listingId === requestedListingId)
        ? requestedListingId
        : (listingSummary[0]?.listingId ?? "");

    const productShareResult = await client.query<{
      item_name: string;
      quantity: string;
      percentage: string;
    }>(
      `
        WITH month_total AS (
          SELECT COALESCE(SUM(quantity), 0)::numeric AS total
          FROM etsy_orders
          WHERE month_key = $1
        )
        SELECT
          o.item_name,
          SUM(o.quantity)::int::text AS quantity,
          CASE
            WHEN t.total = 0 THEN 0
            ELSE ROUND((SUM(o.quantity)::numeric * 100.0 / t.total), 2)
          END::text AS percentage
        FROM etsy_orders o
        CROSS JOIN month_total t
        WHERE o.month_key = $1
        GROUP BY o.item_name, t.total
        ORDER BY SUM(o.quantity) DESC
      `,
      [monthKey],
    );

    const stateRankingResult = await client.query<{
      ship_state: string;
      quantity: string;
      order_count: string;
    }>(
      `
        SELECT
          ship_state,
          SUM(quantity)::int::text AS quantity,
          COUNT(DISTINCT order_id)::int::text AS order_count
        FROM etsy_orders
        WHERE month_key = $1
        GROUP BY ship_state
        ORDER BY SUM(quantity) DESC
      `,
      [monthKey],
    );

    const dailyResult = selectedListingId
      ? await client.query<{ day_of_month: string; quantity: string }>(
          `
            SELECT
              day_of_month::text,
              SUM(quantity)::int::text AS quantity
            FROM etsy_orders
            WHERE month_key = $1 AND listing_id = $2
            GROUP BY day_of_month
            ORDER BY day_of_month ASC
          `,
          [monthKey, selectedListingId],
        )
      : { rows: [] as { day_of_month: string; quantity: string }[] };

    const dailyMap = new Map<number, number>(
      dailyResult.rows.map((row) => [Number(row.day_of_month), Number(row.quantity)]),
    );

    const listingDaily: DailySales[] = getDaysInMonth(monthKey).map((dayKey) => {
      const dayNumber = Number(dayKey.split("-")[2]);
      return {
        day: format(new Date(`${dayKey}T00:00:00`), "MMM dd", { locale: enUS }),
        quantity: dailyMap.get(dayNumber) ?? 0,
      };
    });

    return {
      month: monthKey,
      rowCount,
      totalQuantity,
      selectedListingId,
      listingSummary,
      productShare: productShareResult.rows.map((row) => ({
        itemName: row.item_name,
        quantity: Number(row.quantity),
        percentage: Number(row.percentage),
      })),
      stateRanking: stateRankingResult.rows.map((row) => ({
        shipState: row.ship_state,
        quantity: Number(row.quantity),
        orderCount: Number(row.order_count),
      })),
      listingDaily,
    };
  } finally {
    client.release();
  }
}
