import React, { useEffect, useState } from "react";
import { api, clearToken } from "../api";
import NewFinanceForm from "../components/NewFinanceForm";
import TrackFinance from "../components/TrackFinance";
import MobileTabBar from "../components/MobileTabBar";
import GlassBG from "../components/GlassBG";

export default function Dashboard({ onLogout }){
  const [tab, setTab] = useState("new");
  const [summary, setSummary] = useState({ total_principal: 0, total_outstanding: 0 });

  async function loadSummary(){
    try{ setSummary(await api.summary()); }catch{}
  }
  useEffect(()=>{ loadSummary(); }, []);

  return (
    <div className="app-bg min-h-screen">
      <GlassBG /> 
      <div className="container-app">
        <header className="header">
  <h1 className="brand">Likesh Reddy Finance</h1>

  <div className="kpis">
    <span className="kpi">Outstanding: ₹ {Number(summary.total_outstanding||0).toLocaleString()}</span>
    <span className="kpi">Total Principal: ₹ {Number(summary.total_principal||0).toLocaleString()}</span>
    <button
      className="logout border hover:bg-white/80"
      onClick={() => { clearToken(); onLogout?.(); }}
    >
      Logout
    </button>
  </div>
</header>


        {/* Tabs (desktop) */}
        <div className="hidden md:flex tabs">
          <button className={`tab ${tab==="new"?"tab-active":""}`} onClick={()=>setTab("new")}>New Finance</button>
          <button className={`tab ${tab==="track"?"tab-active":""}`} onClick={()=>setTab("track")}>Track Existing</button>
        </div>

        {/* Views */}
        <div className="mb-24 md:mb-10">
          {tab === "new" ? (
            <NewFinanceForm onCreated={() => { setTab("track"); loadSummary(); }} />
          ) : (
            <TrackFinance onChanged={loadSummary} />
          )}
        </div>
      </div>

      {/* Mobile: sticky bottom bar + FAB */}
      <MobileTabBar tab={tab} onTab={setTab} />
      {tab !== "new" && (
        <button className="mobile-fab" onClick={()=>setTab("new")}>+ New</button>
      )}
    </div>
  );
}
