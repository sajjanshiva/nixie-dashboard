import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user) navigate(user.role === "admin" ? "/admin/all-tasks" : "/staff/home", { replace: true });
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await login(email, password);
    setLoading(false);
    if (error) setError(error.message);
    // On success, the useEffect above redirects once `user` loads.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-accent" />
          <span className="text-[16px] font-bold text-slate-900">Teamflow</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[14px] outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-slate-600">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[14px] outline-none focus:border-accent"
            />
          </div>
          {error && <p className="text-[12.5px] text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Log In"}
          </button>
        </form>
        <p className="mt-5 text-center text-[11.5px] text-slate-400">
          Accounts are created by an Admin — there's no self-registration.
        </p>
      </div>
    </div>
  );
}
