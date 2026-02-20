export class CreateAutoloadFeedDto {
  projectId: string;
  name: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  autoPublish?: boolean;
  defaultBid?: number;
  defaultBidType?: string;
  cronExpression?: string;
}

export class UpdateAutoloadFeedDto {
  name?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  autoPublish?: boolean;
  defaultBid?: number;
  defaultBidType?: string;
  cronExpression?: string;
  status?: string;
}

export class CreateAutoloadItemDto {
  feedId: string;
  externalId?: string;
  title: string;
  category?: string;
  publishAt?: string;
  unpublishAt?: string;
  bid?: number;
  bidType?: string;
  cityBids?: Record<string, number>;
  scheduleSlots?: Array<{ dayOfWeek: number; startHour: number; endHour: number }>;
  price?: number;
  rawData?: any;
}

export class UpdateAutoloadItemDto {
  title?: string;
  category?: string;
  status?: string;
  publishAt?: string;
  unpublishAt?: string;
  bid?: number;
  bidType?: string;
  cityBids?: Record<string, number>;
  scheduleSlots?: Array<{ dayOfWeek: number; startHour: number; endHour: number }>;
  price?: number;
  rawData?: any;
}

export class SetItemBidDto {
  bid: number;
  bidType?: string;
  cityBids?: Record<string, number>;
}

export class CreateScheduleSlotDto {
  feedId: string;
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  enabled?: boolean;
  bid?: number;
  bidType?: string;
}

export class UpdateScheduleSlotDto {
  dayOfWeek?: number;
  startHour?: number;
  endHour?: number;
  enabled?: boolean;
  bid?: number;
  bidType?: string;
}

export class BulkSetBidsDto {
  itemIds: string[];
  bid: number;
  bidType?: string;
  cityBids?: Record<string, number>;
}
