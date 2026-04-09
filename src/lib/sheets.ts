import { google } from "googleapis";
import type { EtsyOrderRow } from "@/types/etsy";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const HEADER_ROW = [
  "Sale Date",
  "Item Name",
  "Quantity",
  "Price",
  "Listing ID",
  "Ship State",
  "Order ID",
  "Month Key",
  "Day Key",
];

function getSpreadsheetId(): string {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured.");
  }

  return spreadsheetId;
}

function getGoogleCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google service account credentials are missing. Configure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }

  return { client_email: clientEmail, private_key: privateKey };
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getGoogleCredentials(),
    scopes: SCOPES,
  });

  return google.sheets({ version: "v4", auth });
}

async function ensureMonthSheet(monthKey: string) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  const existingTitles = new Set(
    (spreadsheet.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
  );

  if (!existingTitles.has(monthKey)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: monthKey } } }],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheetTitle(monthKey)}!A1:I1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [HEADER_ROW],
    },
  });
}

function rowsToValues(rows: EtsyOrderRow[]): string[][] {
  return rows.map((row) => [
    row.saleDate,
    row.itemName,
    String(row.quantity),
    String(row.price),
    row.listingId,
    row.shipState,
    row.orderId,
    row.monthKey,
    row.dayKey,
  ]);
}

function valuesToRows(values: string[][]): EtsyOrderRow[] {
  return values
    .filter((row) => row.length >= 9)
    .map((row) => {
      const [saleDate, itemName, quantity, price, listingId, shipState, orderId, monthKey, dayKey] = row;
      const dayOfMonth = Number(dayKey.split("-")[2] || "0");

      return {
        saleDate,
        itemName,
        quantity: Number(quantity),
        price: Number(price),
        listingId,
        shipState,
        orderId,
        monthKey,
        dayKey,
        dayOfMonth,
      };
    })
    .filter((row) => !Number.isNaN(row.quantity) && !Number.isNaN(row.price));
}

export async function overwriteMonthRows(monthKey: string, rows: EtsyOrderRow[]) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await ensureMonthSheet(monthKey);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quoteSheetTitle(monthKey)}!A2:I`,
  });

  if (rows.length === 0) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheetTitle(monthKey)}!A2:I`,
    valueInputOption: "RAW",
    requestBody: {
      values: rowsToValues(rows),
    },
  });
}

export async function readMonthRows(monthKey: string): Promise<EtsyOrderRow[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await ensureMonthSheet(monthKey);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetTitle(monthKey)}!A2:I`,
  });

  return valuesToRows((response.data.values as string[][] | undefined) ?? []);
}
