"use client";
import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { subscribeToAuth, isFirebaseConfigured } from "@/lib/dbService";
import Sidebar from "./Sidebar";
import { Menu, X, AlertTriangle, Loader2 } from "lucide-react";
import BullLogo from "./BullLogo";

export default function AppShell({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // Simple routing rules
      if (!currentUser && pathname !== "/login") {
        router.push("/login");
      } else if (currentUser && pathname === "/login") {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => console.log("Service Worker registrado con éxito:", reg.scope))
        .catch((err) => console.error("Error al registrar Service Worker:", err));
    }
  }, []);

  // Protect pages while loading
  if (loading) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
        color: "var(--text-secondary)",
        gap: "1rem"
      }}>
        <Loader2 className="animate-spin" size={40} style={{ stroke: "var(--accent-light)" }} />
        <p style={{ letterSpacing: "0.05em", fontSize: "0.9rem" }}>Cargando sistema...</p>
        <style jsx global>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  // If not logged in and not on login page, render nothing while redirecting
  if (!user && !isLoginPage) {
    return null;
  }

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button className="menu-btn" onClick={() => setIsMobileOpen(!isMobileOpen)}>
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <BullLogo size={24} />
          <span style={{ fontWeight: 700, fontSize: "1.1rem", background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            INVENTARIO
          </span>
        </div>
        <div style={{ width: 24 }}></div> {/* spacer */}
      </header>

      {/* Sidebar Navigation */}
      <Sidebar 
        user={user} 
        isMobileOpen={isMobileOpen} 
        setIsMobileOpen={setIsMobileOpen} 
      />

      {/* Main Page Area */}
      <main className="main-content">
        {/* Warning Banner if using LocalStorage Fallback */}
        {!isFirebaseConfigured && (
          <div className="fallback-banner">
            <AlertTriangle size={18} />
            <div>
              <strong>Modo de Fallback Local:</strong> Los datos se están guardando en el navegador (LocalStorage). 
              Para conectar tu base de datos Firebase real, configura las variables de entorno en un archivo <code>.env.local</code>.
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
