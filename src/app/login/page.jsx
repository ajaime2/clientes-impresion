"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { supabase } from "../Libreria/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  // Si ya hay sesión, manda directo al dashboard
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) router.push("/dashboard");
    })();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();

    const em = email.trim();
    const pw = password.trim();

    if (!em || !pw) {
      Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Ingrese correo y contraseña",
      });
      return;
    }

    try {
      setCargando(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: em,
        password: pw,
      });

      if (error) {
        Swal.fire({
          icon: "error",
          title: "Acceso denegado",
          text: "Correo o contraseña incorrectos",
        });
        return;
      }

      const userEmail = data?.user?.email ?? em;

      await Swal.fire({
        icon: "success",
        title: "Bienvenido",
        text: userEmail,
        timer: 900,
        showConfirmButton: false,
      });

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error inesperado",
        text: err.message ?? "Ocurrió un error",
      });
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="loginWrap">
      <section className="loginCard">
        <div className="left">
          <div className="badge">CP</div>
          <h2>Clientes & Licencias</h2>
          <p>Acceso interno (solo usuarios autorizados)</p>

          <div className="tips">
            <div className="tip">Software</div>
            <div className="tip">Contimaca de Costa Rica</div>
          </div>
        </div>

        <div className="right">
          <h1>Login</h1>
          <p className="sub">Ingresa con tu correo corporativo</p>

          <form onSubmit={handleLogin} className="form">
            <label className="label">Correo</label>
            <input
              className="input"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              type="email"
            />

            <label className="label">Contraseña</label>
            <input
              className="input"
              placeholder="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button className="btn" type="submit" disabled={cargando}>
              {cargando ? "Validando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </section>

      <style jsx>{`
        .loginWrap {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 22px;
          background: radial-gradient(1200px 600px at 20% 0%, rgba(34, 197, 94, 0.18), transparent 55%),
            radial-gradient(900px 500px at 80% 100%, rgba(10, 93, 42, 0.16), transparent 55%),
            #f6f7fb;
        }
        .loginCard {
          width: min(980px, 100%);
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid #e7eaf0;
          box-shadow: 0 20px 55px rgba(15, 23, 42, 0.14);
          background: #fff;
        }
        .left {
          padding: 26px;
          color: #eaf7ef;
          background: linear-gradient(135deg, #0a5d2a, #0b1220);
          position: relative;
        }
        .badge {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          font-weight: 1000;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.18);
          margin-bottom: 12px;
        }
        .left h2 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.02em;
        }
        .left p {
          margin: 6px 0 0;
          opacity: 0.9;
        }
        .tips {
          margin-top: 18px;
          display: grid;
          gap: 10px;
        }
        .tip {
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.16);
          font-weight: 800;
          font-size: 13px;
        }

        .right {
          padding: 26px;
        }
        .right h1 {
          margin: 0;
          font-size: 24px;
          letter-spacing: -0.02em;
        }
        .sub {
          margin: 6px 0 16px;
          opacity: 0.75;
          font-size: 13px;
        }
        .form {
          display: grid;
          gap: 10px;
        }
        .label {
          font-size: 12px;
          font-weight: 900;
          opacity: 0.85;
          margin-top: 6px;
        }
        .input {
          width: 100%;
          padding: 12px 12px;
          border-radius: 14px;
          border: 1px solid #d8dde6;
          outline: none;
          font-size: 14px;
          background: #fff;
        }
        .input:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
        }
        .btn {
          margin-top: 10px;
          padding: 12px 14px;
          border-radius: 14px;
          border: none;
          background: #0a5d2a;
          color: #fff;
          font-weight: 1000;
          cursor: pointer;
        }
        .btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .loginCard {
            grid-template-columns: 1fr;
          }
          .left {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}
