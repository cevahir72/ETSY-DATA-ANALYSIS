export type EtsyOrderRow = {
  saleDate: string;
  itemName: string;
  quantity: number;
  price: number;
  listingId: string;
  shipState: string;
  orderId: string;
  monthKey: string;
  dayKey: string;
  dayOfMonth: number;
};

export type ListingSummary = {
  listingId: string;
  itemName: string;
  quantity: number;
};

export type ProductShare = {
  itemName: string;
  quantity: number;
  percentage: number;
};

export type StateRanking = {
  shipState: string;
  quantity: number;
  orderCount: number;
};

export type DailySales = {
  day: string;
  quantity: number;
};

export type AnalyticsPayload = {
  month: string;
  rowCount: number;
  totalQuantity: number;
  selectedListingId: string;
  listingSummary: ListingSummary[];
  productShare: ProductShare[];
  stateRanking: StateRanking[];
  listingDaily: DailySales[];
};
