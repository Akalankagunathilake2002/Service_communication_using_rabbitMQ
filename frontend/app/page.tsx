"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OrderForm from "@/components/OrderForm";
import LiveFeed from "@/components/LiveFeed";
import StatsCharts from "@/components/StatsCharts";
import TopologyView from "@/components/TopologyView";
import { useDashboardData } from "@/lib/useDashboardData";

export default function Home() {
  const { orders, events, connected } = useDashboardData();

  return (
    <div className="flex min-h-screen flex-col">
      <Header connected={connected} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <OrderForm />
            <LiveFeed events={events} connected={connected} />
          </div>
          <div className="space-y-6">
            <StatsCharts orders={orders} />
            <TopologyView />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
