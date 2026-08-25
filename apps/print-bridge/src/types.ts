/** Kuyruktan gelen fişin gövdesi (API: PrintRouter::payload). */
export type TicketLine = {
  name: string | null;
  quantity: number;
  note?: string | null;
  modifiers?: string[];
};

export type TicketPayload = {
  type: 'order' | 'addition' | 'bill' | 'test';
  printer: { id: number; name: string; kind: string };
  order?: {
    id: number;
    source?: string | null;
    table?: string | null;
    placed_at?: string | null;
    note?: string | null;
  };
  lines: TicketLine[];
  copies?: number;
};

export type PrintJob = {
  id: number;
  type: TicketPayload['type'];
  payload_json: TicketPayload;
  printer: {
    id: number;
    name: string;
    kind: string;
    /** "192.168.1.50:9100" · "\\KASA-PC\MUTFAK" · "file:./cikti.bin" */
    target: string | null;
    copies: number;
  } | null;
};
