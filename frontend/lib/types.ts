export type OrderStatus = "created" | "reserved" | "failed" | "unknown";

export interface OrderItem {
  sku: string;
  qty: number;
  price: number;
}

export interface Order {
  order_id: string;
  customer: string | null;
  items: OrderItem[];
  total: number | null;
  status: OrderStatus;
  reason: string | null;
  created_at: string;
  updated_at: string;
  history: { routing_key: string; at: string }[];
}

export interface DashboardEvent {
  routing_key: string;
  order: Order;
  received_at: string;
}

export interface TopologyQueue {
  name: string;
  messages_ready: number;
  messages_unacknowledged: number;
  consumers: number;
}

export interface TopologyBinding {
  routing_key: string;
  destination: string;
}

export interface Topology {
  exchange: string;
  exchange_type: string;
  bindings: TopologyBinding[];
  queues: TopologyQueue[];
}
