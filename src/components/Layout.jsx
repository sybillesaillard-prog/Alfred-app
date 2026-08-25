import { NavLink, Outlet } from "react-router-dom";
import { Wallet, CalendarClock, TrendingUp, ListTodo, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/depenses", label: "Dépenses", icon: Wallet },
  { to: "/charges-fixes", label: "Charges fixes", icon: CalendarClock },
  { to: "/charges-variables", label: "Charges variables", icon: TrendingUp },
  { to: "/taches", label: "Tâches", icon: ListTodo },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-slate-800 md:p-4">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-sky-400 flex items-center justify-center text-sm font-bold text-slate-950">
            A
          </div>
          <span className="font-semibold">Alfred</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? "bg-sky-400/10 text-sky-300"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 pt-3 mt-3">
          <p className="px-3 text-xs text-slate-500 truncate mb-2">
            {user?.email}
          </p>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-900 hover:text-red-400 transition w-full"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 safe-top">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sky-400 flex items-center justify-center text-xs font-bold text-slate-950">
            A
          </div>
          <span className="font-semibold">Alfred</span>
        </div>
        <button
          onClick={logout}
          className="text-slate-400 hover:text-red-400 transition p-1"
          aria-label="Déconnexion"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-3xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex border-t border-slate-800 bg-slate-950/95 backdrop-blur safe-bottom">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition ${
                isActive ? "text-sky-300" : "text-slate-500"
              }`
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
