"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { OverviewSection } from "@/components/dashboard/sections/overview";
import { PipelineSection } from "@/components/dashboard/sections/pipeline";
import { DealsSection } from "@/components/dashboard/sections/deals";
import { CustomersSection } from "@/components/dashboard/sections/customers";
import { TeamSection } from "@/components/dashboard/sections/team";
import { ForecastingSection } from "@/components/dashboard/sections/forecasting";
import { ReportsSection } from "@/components/dashboard/sections/reports";
import { BrainDumpSection } from "@/components/dashboard/sections/brain-dump";
import { VaultSection } from "@/components/dashboard/sections/vault";
import { MindGraphSection } from "@/components/dashboard/sections/mind-graph";
import { AskBrainSection } from "@/components/dashboard/sections/ask-brain";
import { SettingsSection } from "@/components/dashboard/sections/settings";

export type Section = "overview" | "pipeline" | "deals" | "customers" | "team" | "forecasting" | "reports" | "brain-dump" | "vault" | "mind-graph" | "ask-brain" | "settings";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection />;
      case "pipeline":
        return <PipelineSection />;
      case "deals":
        return <DealsSection />;
      case "customers":
        return <CustomersSection />;
      case "team":
        return <TeamSection />;
      case "forecasting":
        return <ForecastingSection />;
      case "reports":
        return <ReportsSection />;
      case "brain-dump":
        return <BrainDumpSection />;
      case "vault":
        return <VaultSection />;
      case "mind-graph":
        return <MindGraphSection />;
      case "ask-brain":
        return <AskBrainSection />;
      case "settings":
        return <SettingsSection />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-out ${
          sidebarCollapsed ? "ml-[72px]" : "ml-[260px]"
        }`}
      >
        {activeSection !== "mind-graph" && <Header activeSection={activeSection} />}
        <main className={`flex-1 overflow-auto ${activeSection === "mind-graph" ? "p-0" : "p-6"}`}>
          <div
            key={activeSection}
            className={activeSection === "mind-graph" ? "" : "animate-in fade-in slide-in-from-bottom-4 duration-500"}
          >
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  );
}
