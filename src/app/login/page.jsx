"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { supabase } from "../Libreria/supabaseClient";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";


import animationData from "../animations/drawkit-grape-animation-1-LOOP.json";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

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
          <div className="badge">
            <img 
              src="/contimaca.png" 
              alt="Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
          </div>
          <h2>Clientes & Licencias</h2>
          <p>Acceso interno (solo usuarios autorizados)</p>

          {/* ✅ Paso 2: Integración de la animación */}
          <div className="animationWrap">
            <Lottie 
              animationData={animationData} 
              loop={true} 
              style={{ width: "100%", height: "220px" }} 
            />
          </div>

        </div>

        <div className="right">
          <h1>Login</h1>
          <p className="sub">Ingresa con tu correo corporativo</p>

          <form onSubmit={handleLogin} className="form">
            <input
              className="input"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              type="email"
            />
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
          display: flex;
          flex-direction: column;
        }
        .badge {
          width: 60px; height: 60px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.14);
          padding: 8px;
          margin-bottom: 12px;
        }
        /* Contenedor de la animación */
        .animationWrap {
          margin: 20px 0;
          filter: drop-shadow(0 10px 15px rgba(0,0,0,0.2));
        }
        .left h2 { margin: 0; font-size: 28px; }
        .left p { margin: 6px 0 0; opacity: 0.9; }
        .tips { margin-top: auto; display: grid; gap: 10px; }
        .tip {
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.16);
          font-weight: 800; font-size: 13px;
        }
        .right { padding: 40px; }
        .right h1 { margin: 0; font-size: 24px; }
        .sub { margin: 6px 0 16px; opacity: 0.75; font-size: 13px; }
        .form { display: grid; gap: 10px; }
        .input {
          width: 100%; padding: 12px; border-radius: 14px;
          border: 1px solid #d8dde6; font-size: 14px;
        }
        .input:focus { border-color: #16a34a; outline: none; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18); }
        .btn {
          margin-top: 10px; padding: 12px; border-radius: 14px;
          border: none; background: #0a5d2a; color: #fff;
          font-weight: 1000; cursor: pointer;
        }
        .btn:disabled { opacity: 0.7; }
        @media (max-width: 900px) {
          .loginCard { grid-template-columns: 1fr; }
          .left { display: none; }
        }

        .btn {
          margin-top: 10px; 
          padding: 12px; 
          border-radius: 14px;
          border: none; 
          background: #0a5d2a; 
          color: #fff;
          font-weight: 800; 
          cursor: pointer;
          transition: all 0.2s ease; /* Transición suave */
        }

        /*  Hover */
        .btn:hover:not(:disabled) {
          background: #0e7a37;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(10, 93, 42, 0.25);
        }

        /*  Active: Efecto de pulsado */
        .btn:active:not(:disabled) {
          transform: translateY(0);
          background: #084d23;
        }

        .btn:disabled { 
          opacity: 0.7; 
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}