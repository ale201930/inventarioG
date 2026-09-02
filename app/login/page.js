"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser, resetPassword, isFirebaseConfigured } from "@/lib/dbService";
import { KeyRound, User, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import BullLogo from "@/components/BullLogo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      await loginUser(email, password);
      // Let authentication listener trigger redirection, but push just in case
      router.push("/");
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    if (!email.trim()) {
      setError("Por favor ingresa tu usuario o correo electrónico.");
      setLoading(false);
      return;
    }

    try {
      await resetPassword(email);
      setSuccessMessage("¡Enlace de recuperación enviado! Revisa la bandeja de entrada de tu correo (y la carpeta de spam).");
    } catch (err) {
      setError(err.message || "Error al enviar el enlace de recuperación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="card login-card">
        <div className="login-logo">
          <BullLogo size={130} />
          <h1 className="login-logo-text">INVENTARIO</h1>
          <p className="login-subtitle">Sistema de Control y Saldos</p>
        </div>

        {isRecovering ? (
          <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, textAlign: "center", marginBottom: "0.25rem", color: "var(--text-primary)" }}>
              Recuperar Contraseña
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "center", marginBottom: "0.5rem" }}>
              Ingresa tu usuario o correo para recibir un enlace de restablecimiento.
            </p>

            {error && (
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                padding: "0.75rem",
                borderRadius: "8px",
                color: "var(--danger)",
                fontSize: "0.85rem"
              }}>
                <AlertCircle size={16} style={{ marginTop: "2px", flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                padding: "0.75rem",
                borderRadius: "8px",
                color: "var(--success)",
                fontSize: "0.85rem"
              }}>
                <CheckCircle size={16} style={{ marginTop: "2px", flexShrink: 0 }} />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="recover-email">Usuario o Correo Electrónico</label>
              <div style={{ position: "relative" }}>
                <User size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  id="recover-email"
                  type="text"
                  placeholder="Ej. alexander almaguer"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: "40px" }}
                  required
                />
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Ingresa el mismo usuario o correo con el que inicias sesión.
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: "0.5rem", width: "100%" }}
              disabled={loading}
            >
              {loading ? "Enviando enlace..." : "Enviar Enlace de Recuperación"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsRecovering(false);
                setError("");
                setSuccessMessage("");
              }}
              style={{ width: "100%" }}
            >
              Volver al Inicio de Sesión
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {error && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                padding: "0.75rem",
                borderRadius: "8px",
                color: "var(--danger)",
                fontSize: "0.85rem"
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Usuario o Correo Electrónico</label>
              <div style={{ position: "relative" }}>
                <User size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  id="email"
                  type="text"
                  placeholder="Ej. alexander almaguer"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: "40px" }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div style={{ position: "relative" }}>
                <KeyRound size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: "40px", paddingRight: "44px" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "color 0.2s"
                  }}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "-0.25rem" }}>
              <button
                type="button"
                onClick={() => {
                  setIsRecovering(true);
                  setError("");
                  setSuccessMessage("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-light)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline"
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: "0.5rem", width: "100%" }}
              disabled={loading}
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </button>
          </form>
        )}

        {!isFirebaseConfigured && (
          <div style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: "0.5rem",
            background: "rgba(255, 255, 255, 0.02)",
            padding: "0.75rem",
            borderRadius: "8px",
            border: "1px solid var(--card-border)"
          }}>
            <p style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
              Credenciales de prueba (Fallback Local):
            </p>
            <p>Usuario: <code>admin</code> o <code>admin@admin.com</code></p>
            <p>Contraseña: <code>admin</code></p>
          </div>
        )}
      </div>
    </div>
  );
}
