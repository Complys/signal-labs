"use client";
import { useState } from "react";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: Date;
};

type Props = { users: User[] };

const ROLES = ["ADMIN", "FULFILMENT", "USER"];

const rolePill = (role: string) => {
  const base = "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ";
  if (role === "ADMIN") return base + "bg-purple-900/40 text-purple-300 border border-purple-500/30";
  if (role === "FULFILMENT") return base + "bg-blue-900/40 text-blue-300 border border-blue-500/30";
  return base + "bg-white/5 text-white/50 border border-white/10";
};

export default function UsersClient({ users: initial }: Props) {
  const [users, setUsers] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", password: "", role: "FULFILMENT" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Failed"); }
      else {
        setUsers(prev => [data.user, ...prev]);
        setShowAdd(false);
        setForm({ email: "", firstName: "", lastName: "", password: "", role: "FULFILMENT" });
        setMsg("User created successfully");
      }
    } catch { setMsg("Server error"); }
    setSaving(false);
  }

  async function updateRole(id: string, role: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
        setEditId(null);
        setMsg("Role updated");
      }
    } catch { setMsg("Error updating role"); }
    setSaving(false);
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== id));
  }

  return (
    <main style={{ padding: "32px 40px", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", margin: 0 }}>User Management</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "4px 0 0" }}>
            Add staff accounts and control their access level
          </p>
        </div>
        <button
          onClick={() => setShowAdd(s => !s)}
          style={{ background: "#fff", color: "#000", border: "none", borderRadius: 20, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {showAdd ? "Cancel" : "+ Add user"}
        </button>
      </div>

      {msg && (
        <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#fff" }}>
          {msg}
        </div>
      )}

      {showAdd && (
        <form onSubmit={addUser} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: "0 0 16px" }}>New user</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "First name", key: "firstName", type: "text" },
              { label: "Last name", key: "lastName", type: "text" },
              { label: "Email address", key: "email", type: "email" },
              { label: "Password", key: "password", type: "password" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</label>
                <input
                  type={type}
                  required
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", boxSizing: "border-box" as const }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Access level</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff" }}
            >
              <option value="FULFILMENT">Fulfilment — orders and shipping only</option>
              <option value="ADMIN">Admin — full access</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            style={{ marginTop: 16, background: "#fff", color: "#000", border: "none", borderRadius: 20, padding: "9px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {saving ? "Creating..." : "Create user"}
          </button>
        </form>
      )}

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["Name", "Email", "Role", "Joined", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <td style={{ padding: "12px 16px", color: "#fff" }}>
                  {u.firstName || u.lastName ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "—"}
                </td>
                <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.7)" }}>{u.email}</td>
                <td style={{ padding: "12px 16px" }}>
                  {editId === u.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#fff" }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button onClick={() => updateRole(u.id, editRole)} style={{ background: "#fff", color: "#000", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                      <button onClick={() => setEditId(null)} style={{ background: "transparent", color: "rgba(255,255,255,0.4)", border: "none", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  ) : (
                    <span className={rolePill(u.role)}>{u.role}</span>
                  )}
                </td>
                <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.4)" }}>
                  {new Date(u.createdAt).toLocaleDateString("en-GB")}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setEditId(u.id); setEditRole(u.role); }}
                      style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}
                    >
                      Edit role
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      style={{ fontSize: 12, color: "rgba(255,100,100,0.7)", background: "transparent", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No users yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20, padding: "14px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          <strong style={{ color: "rgba(255,255,255,0.6)" }}>Fulfilment</strong> — can only see orders and shipping info. Cannot access products, blog, analytics, or settings.<br/>
          <strong style={{ color: "rgba(255,255,255,0.6)" }}>Admin</strong> — full access to everything.
        </p>
      </div>
    </main>
  );
}
