"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { supabase } from "../Libreria/supabaseClient";

/** =======================
 *  Utils fechas / estado
 *  ======================= */
function parseDateSafe(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function daysDiffFromToday(dateValue) {
  const d = parseDateSafe(dateValue);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
}

// “peor” estado entre vencimiento_licencia / vencimiento_contrato
function getExpiryStatus(row) {
  const candidates = [
    daysDiffFromToday(row.vencimiento_licencia),
    daysDiffFromToday(row.vencimiento_contrato),
  ].filter((x) => x !== null);

  if (candidates.length === 0) return { level: "nofecha", label: "Sin fecha" };

  const minDays = Math.min(...candidates);

  if (minDays < 0) return { level: "expired", label: "Vencido", days: minDays };
  if (minDays <= 15) return { level: "soon", label: `Vence en ${minDays} días`, days: minDays };
  if (minDays <= 45) return { level: "warn", label: `Advertencia (${minDays} días)`, days: minDays };
  return { level: "ok", label: `Faltan ${minDays} días`, days: minDays };
}

const TABLE = "reporte_clientes_sw";

/** =======================
 *  Campos que editaremos
 *  ======================= */
const FIELDS = [
  { key: "cliente", label: "Cliente", type: "text" },
  { key: "vendedor", label: "Vendedor", type: "text" },
  { key: "nombre_software", label: "Software", type: "text" },
  { key: "modalidad", label: "Modalidad", type: "text" },
  { key: "tipo_de_licencia", label: "Tipo de licencia", type: "text" },
  { key: "marca_licencia", label: "Marca licencia", type: "text" },
  { key: "cantidad_licencia", label: "Cantidad licencia", type: "number" },
  { key: "version_licencia_papercut", label: "Versión licencia", type: "text" },
  { key: "version_instalada_cliente", label: "Versión instalada", type: "text" },
  { key: "propietario_licencia", label: "Propietario licencia", type: "text" },
  { key: "vencimiento_licencia", label: "Vencimiento licencia", type: "date" },
  { key: "vencimiento_contrato", label: "Vencimiento contrato", type: "date" },
  { key: "persona_contacto", label: "Persona contacto", type: "text" },
  { key: "telefono", label: "Teléfono", type: "text" },
  { key: "correo", label: "Correo", type: "text" },
  { key: "direccion", label: "Dirección", type: "text" },
  { key: "notas", label: "Notas", type: "textarea" },
];

function emptyForm() {
  const o = {};
  for (const f of FIELDS) o[f.key] = "";
  return o;
}

export default function DashboardPage() {
  const router = useRouter();

  // ✅ AHORA usuario viene de Supabase Auth (evita bucle)
  const [usuario, setUsuario] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const redirectedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  // UI state
  const [activeMenu, setActiveMenu] = useState("clientes");
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit | view
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // paginación
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ✅ Validar sesión (ANTI LOOP)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setCheckingSession(true);

        // ✅ getSession es más estable al inicio que getUser
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;

        if (!mounted) return;

        if (error || !session?.user) {
          if (!redirectedRef.current) {
            redirectedRef.current = true;
            await Swal.fire({
              icon: "warning",
              title: "Sesión requerida",
              text: "Debes iniciar sesión",
            });
            router.replace("/login");
          }
          return;
        }

        setUsuario(session.user.email);
        await fetchRows();
      } catch (err) {
        console.error(err);
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          router.replace("/login");
        }
      } finally {
        if (mounted) setCheckingSession(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRows() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from(TABLE).select("*").order("id", { ascending: false });
      if (error) throw error;
      setRows(data ?? []);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "Error cargando datos", text: err.message ?? "Ocurrió un error" });
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      Object.values(r).some((v) => (v ?? "").toString().toLowerCase().includes(term))
    );
  }, [q, rows]);

  const stats = useMemo(() => {
    const s = { expired: 0, soon: 0, warn: 0, nofecha: 0, ok: 0 };
    for (const r of filtered) {
      const st = getExpiryStatus(r);
      s[st.level] = (s[st.level] ?? 0) + 1;
    }
    return s;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const logout = async () => {
    await supabase.auth.signOut();
    await Swal.fire({ icon: "success", title: "Sesión cerrada", timer: 800, showConfirmButton: false });
    router.replace("/login");
  };

  function openCreate() {
    setMode("create");
    setSelected(null);
    setForm(emptyForm());
    setOpenModal(true);
  }

  function openView(row) {
    setMode("view");
    setSelected(row);
    setForm(fromRowToForm(row));
    setOpenModal(true);
  }

  function openEdit(row) {
    setMode("edit");
    setSelected(row);
    setForm(fromRowToForm(row));
    setOpenModal(true);
  }

  function fromRowToForm(row) {
    const f = emptyForm();
    for (const field of FIELDS) {
      const v = row?.[field.key];
      if (field.type === "date" && v) f[field.key] = String(v).slice(0, 10);
      else f[field.key] = v ?? "";
    }
    return f;
  }

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    try {
      setSaving(true);

      const payload = {};
      for (const field of FIELDS) {
        let v = form[field.key];

        if (field.type === "number") {
          v = v === "" ? null : Number(v);
          if (Number.isNaN(v)) v = null;
        }
        if (field.type === "date") v = v ? v : null;
        if ((field.type === "text" || field.type === "textarea") && v === "") v = null;

        payload[field.key] = v;
      }

      if (mode === "create") {
        const { error } = await supabase.from(TABLE).insert(payload);
        if (error) throw error;
        Swal.fire({ icon: "success", title: "Creado", timer: 900, showConfirmButton: false });
      } else if (mode === "edit") {
        if (!selected?.id) throw new Error("No hay ID para actualizar");
        const { error } = await supabase.from(TABLE).update(payload).eq("id", selected.id);
        if (error) throw error;
        Swal.fire({ icon: "success", title: "Actualizado", timer: 900, showConfirmButton: false });
      }

      setOpenModal(false);
      await fetchRows();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "Error guardando", text: err.message ?? "Ocurrió un error" });
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row) {
    const res = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar registro?",
      text: `ID ${row.id} - ${row.cliente ?? ""}`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;

    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", row.id);
      if (error) throw error;
      Swal.fire({ icon: "success", title: "Eliminado", timer: 900, showConfirmButton: false });
      await fetchRows();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "Error eliminando", text: err.message ?? "Ocurrió un error" });
    }
  }

  // ✅ mientras valida sesión
  if (checkingSession) {
    return <div style={{ padding: 20 }}>Validando sesión...</div>;
  }
  if (!usuario) return null;

  return (
    <div className="appShell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brandLogo">CP</div>
          <div>
            <div className="brandTitle">Clientes</div>
            <div className="brandSub">Panel Admin</div>
          </div>
        </div>

        <nav className="nav">
          <button
            className={`navItem ${activeMenu === "clientes" ? "active" : ""}`}
            onClick={() => setActiveMenu("clientes")}
          >
            📋 Clientes / Licencias
          </button>

          <button
            className="navItem"
            onClick={() =>
              Swal.fire({
                icon: "info",
                title: "Próximo paso",
                text: "Cuando quieras, agregamos más tablas aquí (menú lateral) con el mismo CRUD.",
              })
            }
          >
            🧩 Otras tablas (próx.)
          </button>

          <div className="navDivider" />

          <button className="navItem danger" onClick={logout}>
            ⎋ Cerrar sesión
          </button>
        </nav>

        <div className="sidebarFooter">
          <div className="who">
            <div className="whoDot" />
            <div>
              <div className="whoName">{usuario}</div>
              <div className="whoSub">Conectado</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="h1">Dashboard</h1>
            <div className="sub">Vencimientos y gestión de clientes</div>
          </div>

          <div className="actions">
            <div className="searchWrap">
              <span className="searchIcon">🔎</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por cualquier campo..."
                className="search"
              />
            </div>

            {/* ✅ Botón pequeño + texto */}
            <button className="btn btnSm" onClick={openCreate}>
              + Agregar cliente
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="stats">
          <span className="chip red">Vencido: {stats.expired}</span>
          <span className="chip yellow">Vence pronto (≤15): {stats.soon}</span>
          <span className="chip amber">Advertencia (≤45): {stats.warn}</span>
          <span className="chip gray">Sin fecha: {stats.nofecha}</span>
        </section>

        {/* Table */}
        <section className="card">
          {loading ? (
            <div className="empty">Cargando...</div>
          ) : (
            <>
              <div className="table">
                <div className="thead">
                  <div>Cliente</div>
                  <div>Software</div>
                  <div>Contacto</div>
                  <div>Vencimientos</div>
                  <div>Estado</div>
                  <div className="right">Acciones</div>
                </div>

                {pageRows.map((r) => {
                  const st = getExpiryStatus(r);
                  return (
                    <div
                      key={r.id}
                      className={`trow ${st.level}`}
                      onDoubleClick={() => openView(r)}
                      title="Doble click para ver detalle"
                    >
                      <div className="cell">
                        <div className="title">{r.cliente ?? "-"}</div>
                        <div className="muted">
                          ID #{r.id} · {r.modalidad ?? "-"} · {r.marca_licencia ?? "-"}
                        </div>
                      </div>

                      <div className="cell">
                        <div className="title">{r.nombre_software ?? "-"}</div>
                        <div className="muted">
                          {r.tipo_de_licencia ?? "-"} · Qty {r.cantidad_licencia ?? "-"}
                        </div>
                      </div>

                      <div className="cell">
                        <div className="title">{r.persona_contacto ?? "-"}</div>
                        <div className="muted">
                          {r.correo ?? "-"} {r.telefono ? `· ${r.telefono}` : ""}
                        </div>
                      </div>

                      <div className="cell">
                        <div className="muted">Lic: {r.vencimiento_licencia ?? "-"}</div>
                        <div className="muted">Cont: {r.vencimiento_contrato ?? "-"}</div>
                      </div>

                      <div className="cell">
                        <span className={`pill ${st.level}`}>{st.label}</span>
                      </div>

                      <div className="cell right actionsCell" onClick={(e) => e.stopPropagation()}>
                        <button className="mini" onClick={() => openView(r)}>
                          Ver
                        </button>
                        <button className="mini" onClick={() => openEdit(r)}>
                          Editar
                        </button>
                        <button className="mini danger" onClick={() => removeRow(r)}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}

                {pageRows.length === 0 && <div className="empty">No hay resultados.</div>}
              </div>

              {/* Pagination */}
              <div className="pager">
                <div className="muted">
                  Mostrando {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}-
                  {Math.min(page * pageSize, filtered.length)} de {filtered.length}
                </div>

                <div className="pagerBtns">
                  <button className="mini" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    ◀
                  </button>
                  <div className="pagerNum">
                    Página <b>{page}</b> / {totalPages}
                  </div>
                  <button className="mini" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    ▶
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Modal */}
        {openModal && (
          <div className="modalOverlay" onMouseDown={() => setOpenModal(false)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <div className="modalTitle">
                    {mode === "create" ? "Nuevo registro" : mode === "edit" ? "Editar registro" : "Detalle"}
                  </div>
                  <div className="muted">{mode !== "create" ? `ID #${selected?.id}` : "Completa los datos"}</div>
                </div>

                <button className="iconBtn" onClick={() => setOpenModal(false)}>
                  ✕
                </button>
              </div>

              <div className="modalBody">
                <div className="formGrid">
                  {FIELDS.map((f) => (
                    <div className={`field ${f.type === "textarea" ? "span2" : ""}`} key={f.key}>
                      <label className="label">{f.label}</label>

                      {f.type === "textarea" ? (
                        <textarea
                          className="input"
                          rows={3}
                          value={form[f.key] ?? ""}
                          onChange={(e) => setField(f.key, e.target.value)}
                          disabled={mode === "view"}
                        />
                      ) : (
                        <input
                          className="input"
                          type={f.type}
                          value={form[f.key] ?? ""}
                          onChange={(e) => setField(f.key, e.target.value)}
                          disabled={mode === "view"}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="modalFooter">
                <button className="btnGhost" onClick={() => setOpenModal(false)}>
                  Cerrar
                </button>

                {mode !== "view" && (
                  <button className="btn primary" onClick={save} disabled={saving}>
                    {saving ? "Guardando..." : mode === "create" ? "Crear" : "Guardar cambios"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .appShell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px 1fr;
          background: #f6f7fb;
        }

        /* Sidebar */
        .sidebar {
          background: #0b1220;
          color: #e5e7eb;
          padding: 18px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
        }
        .brand {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 10px 8px 14px;
        }
        .brandLogo {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: grid;
          place-items: center;
          font-weight: 900;
          color: #06200f;
        }
        .brandTitle {
          font-weight: 800;
          font-size: 16px;
          line-height: 1;
        }
        .brandSub {
          font-size: 12px;
          opacity: 0.7;
        }
        .nav {
          margin-top: 6px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .navItem {
          text-align: left;
          width: 100%;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #e5e7eb;
          cursor: pointer;
          font-weight: 600;
        }
        .navItem:hover {
          background: rgba(255, 255, 255, 0.07);
        }
        .navItem.active {
          background: rgba(34, 197, 94, 0.16);
          border-color: rgba(34, 197, 94, 0.35);
        }
        .navItem.danger {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.35);
        }
        .navDivider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 10px 0;
        }
        .sidebarFooter {
          margin-top: auto;
          padding-top: 12px;
        }
        .who {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
        }
        .whoDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.14);
        }
        .whoName {
          font-weight: 800;
          line-height: 1.1;
        }
        .whoSub {
          font-size: 12px;
          opacity: 0.7;
        }

        /* Main */
        .main {
          padding: 22px;
        }
        .topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .h1 {
          margin: 0;
          font-size: 26px;
          letter-spacing: -0.02em;
        }
        .sub {
          margin-top: 4px;
          opacity: 0.75;
          font-size: 13px;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .searchWrap {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid #d8dde6;
          background: #fff;
          min-width: 280px;
        }
        .searchIcon {
          opacity: 0.7;
        }
        .search {
          border: none;
          outline: none;
          width: 100%;
          font-size: 14px;
        }

        /* ✅ Botón (hover + pequeño) */
        .btn {
          padding: 10px 14px;
          border-radius: 14px;
          border: 1px solid #d8dde6;
          background: #fff;
          cursor: pointer;
          font-weight: 800;
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }
        .btn:hover {
          background: #f3f4f6;
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(15, 23, 42, 0.12);
        }
        .btn:active {
          transform: translateY(0);
          box-shadow: 0 6px 12px rgba(15, 23, 42, 0.12);
        }
        .btnSm {
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 13px;
        }

        .btn.primary {
          background: #0a5d2a;
          border-color: #0a5d2a;
          color: #fff;
        }
        .btn.primary:hover {
          filter: brightness(0.95);
        }

        /* Chips */
        .stats {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .chip {
          font-size: 12px;
          font-weight: 800;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid;
        }
        .chip.red {
          background: #ffe7e7;
          border-color: #ffb4b4;
          color: #7a0d0d;
        }
        .chip.yellow {
          background: #fff7d6;
          border-color: #ffe08a;
          color: #6b4c00;
        }
        .chip.amber {
          background: #fff1db;
          border-color: #ffd2a0;
          color: #6b3b00;
        }
        .chip.gray {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: #1e3a8a;
        }

        /* Card + Table */
        .card {
          background: #fff;
          border: 1px solid #e7eaf0;
          border-radius: 18px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }
        .table {
          width: 100%;
        }
        .thead,
        .trow {
          display: grid;
          grid-template-columns: 1.2fr 0.9fr 1.1fr 0.8fr 0.8fr 0.8fr;
          gap: 12px;
          align-items: center;
          padding: 14px 16px;
        }
        .thead {
          background: #f6f7fb;
          font-size: 12px;
          font-weight: 900;
          color: #334155;
        }
        .trow {
          border-top: 1px solid #eff2f6;
          cursor: default;
        }
        .trow:hover {
          background: #fbfcff;
        }
        .trow.expired {
          background: #fff1f1;
        }
        .trow.soon {
          background: #fff8e6;
        }
        .trow.warn {
          background: #fff6ec;
        }
        .cell .title {
          font-weight: 900;
          color: #0f172a;
          line-height: 1.2;
        }
        .muted {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 2px;
        }
        .right {
          justify-self: end;
          text-align: right;
        }

        .actionsCell {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .mini {
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid #d8dde6;
          background: #fff;
          font-weight: 900;
          cursor: pointer;
          font-size: 12px;
        }
        .mini:hover {
          background: #f3f4f6;
        }
        .mini.danger {
          border-color: #ffb4b4;
          background: #fff1f1;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 10px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 12px;
          border: 1px solid;
          width: fit-content;
        }
        .pill.ok {
          background: #eafff1;
          border-color: #b7f2c8;
          color: #0b5f2a;
        }
        .pill.warn {
          background: #fff1db;
          border-color: #ffd2a0;
          color: #6b3b00;
        }
        .pill.soon {
          background: #fff7d6;
          border-color: #ffe08a;
          color: #6b4c00;
        }
        .pill.expired {
          background: #ffe7e7;
          border-color: #ffb4b4;
          color: #7a0d0d;
        }
        .pill.nofecha {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: #1e3a8a;
        }

        .empty {
          padding: 18px;
          opacity: 0.8;
        }

        .pager {
          border-top: 1px solid #eff2f6;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pagerBtns {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pagerNum {
          font-size: 12px;
          opacity: 0.75;
        }

        /* Modal */
        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: grid;
          place-items: center;
          padding: 18px;
          z-index: 999;
        }
        .modal {
          width: min(980px, 100%);
          background: #fff;
          border-radius: 18px;
          border: 1px solid #e7eaf0;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }
        .modalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          background: #f6f7fb;
          border-bottom: 1px solid #e7eaf0;
        }
        .modalTitle {
          font-weight: 1000;
          font-size: 16px;
        }
        .iconBtn {
          border: none;
          background: #fff;
          border: 1px solid #d8dde6;
          border-radius: 12px;
          padding: 8px 10px;
          cursor: pointer;
          font-weight: 900;
        }
        .iconBtn:hover {
          background: #f3f4f6;
        }
        .modalBody {
          padding: 16px;
          max-height: 70vh;
          overflow: auto;
        }
        .formGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .field.span2 {
          grid-column: span 2;
        }
        .label {
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
          opacity: 0.8;
        }
        .input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid #d8dde6;
          outline: none;
          font-size: 14px;
        }
        .input:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);
        }
        .modalFooter {
          padding: 12px 16px;
          border-top: 1px solid #e7eaf0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .btnGhost {
          padding: 10px 14px;
          border-radius: 14px;
          border: 1px solid #d8dde6;
          background: #fff;
          cursor: pointer;
          font-weight: 900;
        }
        .btnGhost:hover {
          background: #f3f4f6;
        }

        /* Responsive */
        @media (max-width: 980px) {
          .appShell {
            grid-template-columns: 1fr;
          }
          .sidebar {
            display: none;
          }
          .thead,
          .trow {
            grid-template-columns: 1.3fr 1fr 1.1fr;
          }
          .thead > div:nth-child(4),
          .thead > div:nth-child(5),
          .thead > div:nth-child(6),
          .trow > div:nth-child(4),
          .trow > div:nth-child(5),
          .trow > div:nth-child(6) {
            display: none;
          }
          .formGrid {
            grid-template-columns: 1fr;
          }
          .field.span2 {
            grid-column: span 1;
          }
          .searchWrap {
            min-width: 220px;
          }
        }
      `}</style>
    </div>
  );
}
