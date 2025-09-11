// src/components/InstallAppButton.jsx
import React, { useEffect, useState } from "react";

export default function InstallAppButton({ className = "btn btn-ghost sm:btn" }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true; // iOS

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      console.log("[PWA] beforeinstallprompt captured");
    };
    const onInstalled = () => {
      console.log("[PWA] appinstalled");
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || isStandalone) return null;

  const disabled = !deferred && !isIOS;
  const title = isIOS
    ? "On iPhone: Share → Add to Home Screen"
    : deferred
    ? "Install the app"
    : "Install will enable once the service worker is ready";

  const onClick = async () => {
    if (!deferred) return; // iOS shows tip only
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    console.log("[PWA] userChoice:", outcome);
    if (outcome === "accepted") setDeferred(null);
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" className={className} disabled={disabled} title={title} onClick={onClick}>
        Install App
      </button>
      {isIOS && (
        <span className="text-xs text-slate-500">
          iPhone: Share → <b>Add to Home Screen</b>
        </span>
      )}
    </div>
  );
}
