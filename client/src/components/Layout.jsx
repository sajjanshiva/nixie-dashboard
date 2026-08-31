import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import Avatar from "./Avatar.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { useAuth } from "../lib/AuthContext.jsx";

// Shared shell for both Admin and Staff. Fully responsive:
// - Desktop / tablet (md and up): a fixed left sidebar with icon + label nav.
// - Mobile (below md): the sidebar is hidden, and the same nav items render
//   as a fixed bottom tab bar instead — the layout is genuinely different
//   per breakpoint, not just a squeezed sidebar.
//
// `navItems` is an array of { to, label, icon: LucideIcon, badge? } passed
// in by the admin/staff route wrapper so this one component serves both.
export default function Layout({ navItems, title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-100 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="h-4 w-4 rounded bg-accent" />
          <span className="text-[14px] font-bold text-slate-900">Nixie Dashboard</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition ${isActive ? "bg-accent-soft text-accent-text" : "text-slate-500 hover:bg-slate-50"
                }`
              }
            >
              <span className="flex items-center gap-2.5">
                <item.icon size={16} />
                {item.label}
              </span>
              {item.badge > 0 && (
                <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
          <Avatar name={user?.name || "?"} className="h-8 w-8 text-[11px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-slate-800">{user?.name}</p>
            <p className="text-[10.5px] capitalize text-slate-400">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600" aria-label="Log out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 md:px-6">
          <h1 className="text-[15px] font-bold text-slate-900 md:text-[16px]">{title}</h1>
          <NotificationBell />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? "text-accent" : "text-slate-400"
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
            {item.badge > 0 && (
              <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-accent" />
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
