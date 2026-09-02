"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Package, 
  BarChart3, 
  LogOut
} from "lucide-react";
import BullLogo from "@/components/BullLogo";
import { logoutUser } from "@/lib/dbService";

export default function Sidebar({ user, isMobileOpen, setIsMobileOpen }) {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Entradas (Compras)", href: "/entradas", icon: ArrowDownCircle },
    { name: "Salidas (Ventas)", href: "/salidas", icon: ArrowUpCircle },
    { name: "Inventario", href: "/inventario", icon: Package },
    { name: "Reportes", href: "/reportes", icon: BarChart3 },
  ];

  const handleLogout = async () => {
    try {
      await logoutUser();
      // Wait a moment for state changes
      setTimeout(() => {
        router.push("/login");
      }, 100);
    } catch (e) {
      console.error("Logout failed: ", e);
    }
  };

  // Helper to extract clean name from email/username
  const getCleanName = (email) => {
    if (!email) return "Administrador";
    
    // Parse dynamic username-to-email mapping from env
    let userMap = {};
    try {
      userMap = JSON.parse(process.env.NEXT_PUBLIC_USER_MAP || "{}");
    } catch (e) {}

    // Find if this email matches any mapped value in our dictionary
    const mappedUsername = Object.keys(userMap).find(
      (key) => userMap[key].toLowerCase() === email.toLowerCase()
    );

    // If it was mapped, use the clean mapped username, otherwise fallback to the part before the @
    const baseName = mappedUsername || email.split("@")[0];

    // Specific mapping overrides for display name formatting
    if (baseName === "almagueralexander" || baseName === "alexanderalmaguer" || baseName === "almagueralexander839") {
      return "Alexander Almaguer";
    }

    return baseName
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const displayName = user ? getCleanName(user.email) : "";
  const initials = user
    ? displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "AD"
    : "AD";

  return (
    <aside className={`sidebar ${isMobileOpen ? "open" : ""}`}>
      <div className="sidebar-logo">
        <BullLogo size={36} />
        <span>INVENTARIO</span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">
              {initials}
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>{displayName}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Administrador
              </p>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      )}
    </aside>
  );
}
