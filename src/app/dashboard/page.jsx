"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Lottie from "lottie-react";
import { supabase } from "../Libreria/supabaseClient";

// Importación de la animación 
import animationData from "../animations/drawkit-grape-animation-7-LOOP.json";

/** =======================
 * Utils fechas / estado
 * ======================= */
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

  const [usuario, setUsuario] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const redirectedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  const [activeMenu, setActiveMenu] = useState("clientes");
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("create"); 
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCheckingSession(true);
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;
        if (!mounted) return;
        if (error || !session?.user) {
          if (!redirectedRef.current) {
            redirectedRef.current = true;
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
    return () => { mounted = false; };
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

  useEffect(() => { setPage(1); }, [q]);

  const logout = async () => {
    await supabase.auth.signOut();
    await Swal.fire({ icon: "success", title: "Sesión cerrada", timer: 800, showConfirmButton: false });
    router.replace("/login");
  };

  function openCreate() { setMode("create"); setSelected(null); setForm(emptyForm()); setOpenModal(true); }
  function openView(row) { setMode("view"); setSelected(row); setForm(fromRowToForm(row)); setOpenModal(true); }
  function openEdit(row) { setMode("edit"); setSelected(row); setForm(fromRowToForm(row)); setOpenModal(true); }

  function fromRowToForm(row) {
    const f = emptyForm();
    for (const field of FIELDS) {
      const v = row?.[field.key];
      if (field.type === "date" && v) f[field.key] = String(v).slice(0, 10);
      else f[field.key] = v ?? "";
    }
    return f;
  }

  function setField(k, v) { setForm((prev) => ({ ...prev, [k]: v })); }

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
    } finally { setSaving(false); }
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

  if (checkingSession) return <div style={{ padding: 20 }}>Validando sesión...</div>;
  if (!usuario) return null;

  return (
    <div className="appShell">
      {/* Sidebar - Barra Azul Izquierda */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brandLogo">
            <img 
              src="/contimaca.png"  
              alt="Logo Contimaca" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} 
            />
          </div>
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
                text: "Pronto agregaremos más tablas aquí.",
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

        {/* ✅ Animación de Lottie integrada en el sidebar */}
        <div className="sidebarAnimation">
          <Lottie 
            animationData={animationData} 
            loop={true} 
            style={{ width: "100%", height: "160px" }} 
          />
        </div>

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

      {/* Main Content */}
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
                placeholder="Buscar cliente..."
                className="search"
              />
            </div>
            <button className="btn btnSm btnAdd primary" onClick={openCreate}>
              + Agregar cliente
            </button>
          </div>
        </header>

        <section className="stats">
          <span className="chip red">Vencido: {stats.expired}</span>
          <span className="chip yellow">Vence en 15 días: {stats.soon}</span>
          <span className="chip amber">Aviso 45 días: {stats.warn}</span>
          <span className="chip gray">Sin fecha: {stats.nofecha}</span>
        </section>

        <section className="card">
          {loading ? (
            <div className="empty">Cargando datos...</div>
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
                    >
                      <div className="cell">
                        <div className="title">{r.cliente ?? "-"}</div>
                        <div className="muted">{r.modalidad ?? "-"} · {r.marca_licencia ?? "-"}</div>
                      </div>
                      <div className="cell">
                        <div className="title">{r.nombre_software ?? "-"}</div>
                        <div className="muted">Qty: {r.cantidad_licencia ?? "-"}</div>
                      </div>
                      <div className="cell">
                        <div className="title">{r.persona_contacto ?? "-"}</div>
                        <div className="muted">{r.correo ?? "-"}</div>
                      </div>
                      <div className="cell">
                        <div className="muted">Lic: {r.vencimiento_licencia ?? "-"}</div>
                        <div className="muted">Cont: {r.vencimiento_contrato ?? "-"}</div>
                      </div>
                      <div className="cell">
                        <span className={`pill ${st.level}`}>{st.label}</span>
                      </div>
                      <div className="cell right actionsCell">
                        <button className="mini" onClick={() => openEdit(r)}>Editar</button>
                        <button className="mini danger" onClick={() => removeRow(r)}>Eliminar</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pager">
                <div className="muted">Total: {filtered.length} registros</div>
                <div className="pagerBtns">
                  <button className="mini" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</button>
                  <div className="pagerNum">Página {page} de {totalPages}</div>
                  <button className="mini" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Modal de CRUD */}
        {openModal && (
          <div className="modalOverlay" onMouseDown={() => setOpenModal(false)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <div className="modalTitle">
                    {mode === "create" ? "Nuevo registro" : mode === "edit" ? "Editar registro" : "Detalle"}
                  </div>
                </div>
                <button className="iconBtn" onClick={() => setOpenModal(false)}>✕</button>
              </div>
              <div className="modalBody">
                <div className="formGrid">
                  {FIELDS.map((f) => (
                    <div className={`field ${f.type === "textarea" ? "span2" : ""}`} key={f.key}>
                      <label className="label">{f.label}</label>
                      {f.type === "textarea" ? (
                        <textarea className="input" rows={3} value={form[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} disabled={mode === "view"} />
                      ) : (
                        <input className="input" type={f.type} value={form[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} disabled={mode === "view"} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="modalFooter">
                <button className="btnGhost" onClick={() => setOpenModal(false)}>Cancelar</button>
                {mode !== "view" && <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>}
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

        .sidebar {
          background: linear-gradient(180deg, #0b1220 0%, #0a5d2a 100%);
          color: #e5e7eb;
          padding: 18px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .sidebarAnimation {
          margin: 15px 0;
          filter: drop-shadow(0 10px 15px rgba(0,0,0,0.2));
          opacity: 0.9;
        }

        .brand { display: flex; gap: 12px; align-items: center; padding: 10px 8px 20px; }
        .brandLogo { width: 42px; height: 42px; border-radius: 8px; overflow: hidden; }
        .brandTitle { font-weight: 800; font-size: 16px; }
        .brandSub { font-size: 12px; opacity: 0.7; }
        
        .nav { display: flex; flex-direction: column; gap: 8px; }
        .navItem {
          text-align: left; padding: 12px; border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #e5e7eb; cursor: pointer; font-weight: 600;
        }
        .navItem.active { background: rgba(34, 197, 94, 0.25); border-color: #22c55e; }
        .navItem.danger { color: #fca5a5; }
        .navDivider { height: 1px; background: rgba(255, 255, 255, 0.1); margin: 10px 0; }
        
        .sidebarFooter { margin-top: auto; padding-top: 12px; }
        .who { display: flex; gap: 10px; align-items: center; padding: 12px; border-radius: 14px; background: rgba(0,0,0,0.2); }
        .whoDot { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; }
        .whoName { font-weight: 800; font-size: 13px; word-break: break-all; }

        .main { padding: 24px; overflow-y: auto; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .h1 { font-size: 24px; font-weight: 900; color: #0f172a; margin: 0; }
        
        .actions { display: flex; gap: 12px; }
        .searchWrap { 
          display: flex; align-items: center; gap: 8px; padding: 8px 16px; 
          background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; width: 300px;
        }
        .search { border: none; outline: none; width: 100%; font-size: 14px; }
        
        .btn { 
          padding: 10px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; border: none;
          transition: all 0.2s;
        }
        .btn.primary { background: #0a5d2a; color: #fff; }
        .btn.primary:hover { background: #084a21; transform: translateY(-1px); }

        .stats { display: flex; gap: 10px; margin-bottom: 20px; }
        .chip { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid; }
        .chip.red { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
        .chip.yellow { background: #fef9c3; color: #854d0e; border-color: #fef08a; }
        .chip.amber { background: #ffedd5; color: #9a3412; border-color: #fed7aa; }
        .chip.gray { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }

        .card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .table { width: 100%; display: flex; flex-direction: column; }
        .thead { 
          display: grid; grid-template-columns: 1.2fr 1fr 1.2fr 1fr 0.8fr 0.8fr; 
          padding: 14px 20px; background: #f8fafc; font-size: 12px; font-weight: 800; color: #64748b;
          border-bottom: 1px solid #e2e8f0;
        }
        .trow { 
          display: grid; grid-template-columns: 1.2fr 1fr 1.2fr 1fr 0.8fr 0.8fr; 
          padding: 16px 20px; border-bottom: 1px solid #f1f5f9; align-items: center; transition: background 0.2s;
        }
        .trow:hover { background: #f1f5f9; }
        .title { font-weight: 700; color: #1e293b; }
        .muted { font-size: 12px; color: #64748b; margin-top: 2px; }
        
        .pill { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; border: 1px solid; }
        .pill.expired { background: #fee2e2; color: #b91c1c; }
        .pill.soon { background: #fef9c3; color: #a16207; }
        .pill.ok { background: #dcfce7; color: #15803d; }

        .actionsCell { display: flex; gap: 6px; justify-content: flex-end; }
        .mini { padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; font-size: 11px; cursor: pointer; font-weight: 700; }
        .mini.danger { color: #dc2626; border-color: #fecaca; }

        .pager { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
        .pagerBtns { display: flex; align-items: center; gap: 12px; }

        .modalOverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: #fff; width: 90%; max-width: 800px; border-radius: 20px; overflow: hidden; }
        .modalHeader { padding: 20px; background: #f8fafc; display: flex; justify-content: space-between; }
        .modalBody { padding: 20px; max-height: 60vh; overflow-y: auto; }
        .formGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .span2 { grid-column: span 2; }
        .input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 4px; }
        .modalFooter { padding: 20px; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #e2e8f0; }

        @media (max-width: 1024px) {
          .appShell { grid-template-columns: 1fr; }
          .sidebar { display: none; }
        }

        .navItem {
          text-align: left; 
          padding: 12px; 
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #e5e7eb; 
          cursor: pointer; 
          font-weight: 600;
          transition: all 0.2s ease; /* Transición suave */
        }

        /* ✅ Hover para Clientes / Licencias y otros */
        .navItem:hover {
          background: rgba(255, 255, 255, 0.12);
          transform: translateX(4px); /* Desplazamiento sutil a la derecha */
          border-color: rgba(255, 255, 255, 0.2);
        }

        .navItem.active { 
          background: rgba(34, 197, 94, 0.25); 
          border-color: #22c55e; 
          color: #fff;
        }

        /* ✅ Hover especial para el botón Activo */
        .navItem.active:hover {
          background: rgba(34, 197, 94, 0.35);
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
        }

        /* ✅ Hover para Cerrar Sesión (Pone el fondo rojizo) */
        .navItem.danger { 
          color: #fca5a5; 
        }

        .navItem.danger:hover {
          background: rgba(220, 38, 38, 0.15);
          color: #f87171;
          border-color: rgba(220, 38, 38, 0.3);
        }

        /* ✅ Efecto cuando se hace clic (Active) */
        .navItem:active {
          transform: scale(0.97);
        }

        .navDivider { 
          height: 1px; 
          background: rgba(255, 255, 255, 0.1); 
          margin: 10px 0; 
        }
          
      `}</style>
    </div>
  );
}