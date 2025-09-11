import React from "react";

export default function MobileTabBar({ tab, onTab }) {
  return (
    <nav className="mobile-tabbar">
      <div className="mobile-tabbar-inner">
        <button
          className={`flex-1 tab ${tab==="new" ? "tab-active" : ""}`}
          onClick={()=>onTab("new")}
        >
          New Finance
        </button>
        <button
          className={`flex-1 tab ${tab==="track" ? "tab-active" : ""}`}
          onClick={()=>onTab("track")}
        >
          Track Existing
        </button>
      </div>
    </nav>
  );
}
