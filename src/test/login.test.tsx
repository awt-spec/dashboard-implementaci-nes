import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { mensajeDeError } from "@/lib/authErrors";

const state = vi.hoisted(() => ({
  // Lo que devuelve signInWithPassword en la próxima llamada.
  respuesta: { error: null } as { error: { message: string } | null },
  llamadas: [] as { email: string; password: string }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (creds: { email: string; password: string }) => {
        state.llamadas.push(creds);
        return Promise.resolve(state.respuesta);
      },
    },
  },
}));

import Login from "@/pages/Login";

beforeEach(() => {
  state.respuesta = { error: null };
  state.llamadas = [];
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});
afterEach(() => { vi.restoreAllMocks(); });

const correo = () => screen.getByLabelText("Correo electrónico");
const clave = () => screen.getByLabelText("Contraseña");
const entrar = () => screen.getByRole("button", { name: /Ingresar/ });

function llenar(email = "ana@sysde.com", pw = "secreta123") {
  fireEvent.change(correo(), { target: { value: email } });
  fireEvent.change(clave(), { target: { value: pw } });
}

/**
 * El mapeo es la parte del login donde un error silencioso se ve como una
 * pantalla que "no hace nada": el usuario mete la contraseña buena, Supabase
 * responde algo en inglés y la pantalla no lo explica.
 */
describe("mensajes de error de autenticación", () => {
  it("credencial mala y usuario inexistente dicen lo mismo", () => {
    // Distinguirlos permite descubrir qué correos tienen cuenta.
    const a = mensajeDeError("Invalid login credentials");
    const b = mensajeDeError("User not found");
    expect(a).toBe(b);
    expect(a).toBe("Correo o contraseña incorrectos.");
  });

  it("traduce los casos que la persona puede accionar", () => {
    expect(mensajeDeError("Email not confirmed")).toMatch(/confirmada/);
    expect(mensajeDeError("Too many requests")).toMatch(/intentos/);
    expect(mensajeDeError("Failed to fetch")).toMatch(/conexión/);
    expect(mensajeDeError("User is banned")).toMatch(/deshabilitada/);
  });

  it("nunca deja pasar el texto crudo de la API", () => {
    for (const raw of ["Invalid login credentials", "Some unmapped backend error", "", null, undefined]) {
      const out = mensajeDeError(raw);
      expect(out).not.toBe(raw);
      expect(out).toMatch(/[áéíóúñ¿]|\./); // castellano, no el string original
    }
  });

  it("un error desconocido igual dice algo útil", () => {
    expect(mensajeDeError("PGRST999 weird")).toMatch(/soporte/);
  });
});

describe("login — estructura y accesibilidad", () => {
  it("los campos tienen etiqueta asociada y autocompletado", () => {
    render(<Login />);
    expect(correo()).toHaveAttribute("autocomplete", "email");
    expect(correo()).toHaveAttribute("type", "email");
    expect(clave()).toHaveAttribute("autocomplete", "current-password");
  });

  it("el foco arranca en el correo", () => {
    render(<Login />);
    expect(document.activeElement).toBe(correo());
  });

  it("no publica el listado de cuentas que vivía acá", () => {
    const { container } = render(<Login />);
    const texto = container.textContent ?? "";
    // Los patrones exactos de los 36 correos que se quitaron en ac5054e.
    expect(texto).not.toMatch(/-contratista@/);
    expect(texto).not.toMatch(/cliente\.[a-z]+@/);
    expect(texto).not.toMatch(/Hellen|Orlando|Fauricio|Olga|Castante/);
    // Ni las pestañas ni el rótulo del bloque de cuentas demo.
    expect(container.querySelectorAll("[role=tab]")).toHaveLength(0);
    expect(texto).not.toMatch(/demo|autocompletar/i);
    // Los dos correos que SÍ quedan son genéricos, no cuentas de nadie.
    const correos = texto.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+/g) ?? [];
    expect(new Set(correos)).toEqual(new Set(["soporte@sysde.com"]));
    // El placeholder no es texto del DOM, pero tampoco debe ser una cuenta real.
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("placeholder", "nombre@sysde.com");
  });

  it("el botón de ver contraseña alterna el tipo del campo", () => {
    render(<Login />);
    expect(clave()).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(clave()).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(clave()).toHaveAttribute("type", "password");
  });

  it("el conmutador de tema aplica la clase y la recuerda", () => {
    render(<Login />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /modo oscuro/ }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("sva-theme")).toBe("dark");
  });
});

describe("login — envío", () => {
  it("el botón está inhabilitado hasta que hay correo y contraseña", () => {
    render(<Login />);
    expect(entrar()).toBeDisabled();
    fireEvent.change(correo(), { target: { value: "ana@sysde.com" } });
    expect(entrar()).toBeDisabled();
    fireEvent.change(clave(), { target: { value: "x" } });
    expect(entrar()).toBeEnabled();
  });

  it("recorta los espacios del correo antes de mandarlo", async () => {
    render(<Login />);
    llenar("  ana@sysde.com  ");
    fireEvent.click(entrar());
    await waitFor(() => expect(state.llamadas).toHaveLength(1));
    expect(state.llamadas[0].email).toBe("ana@sysde.com");
  });

  it("un error se queda en pantalla y limpia la contraseña", async () => {
    state.respuesta = { error: { message: "Invalid login credentials" } };
    render(<Login />);
    llenar();
    fireEvent.click(entrar());
    // El error se lee en la pantalla, no en un toast que se va solo.
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("Correo o contraseña incorrectos.");
    // La contraseña se limpia; el correo se conserva para no reescribirlo.
    expect(clave()).toHaveValue("");
    expect(correo()).toHaveValue("ana@sysde.com");
    expect(correo()).toHaveAttribute("aria-invalid", "true");
  });

  it("el error viejo desaparece al reintentar", async () => {
    state.respuesta = { error: { message: "Invalid login credentials" } };
    render(<Login />);
    llenar();
    fireEvent.click(entrar());
    await screen.findByRole("alert");

    state.respuesta = { error: null };
    fireEvent.change(clave(), { target: { value: "la-buena" } });
    fireEvent.click(entrar());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("no manda dos veces si se hace doble clic", async () => {
    // La promesa queda pendiente para simular la red en vuelo.
    let resolver: (v: { error: null }) => void = () => {};
    const pendiente = new Promise<{ error: null }>(r => { resolver = r; });
    const mod = await import("@/integrations/supabase/client");
    vi.spyOn(mod.supabase.auth, "signInWithPassword").mockImplementation(((creds: { email: string; password: string }) => {
      state.llamadas.push(creds);
      return pendiente;
    }) as never);

    render(<Login />);
    llenar();
    // Se guarda la referencia: al enviar, el botón pasa a llamarse
    // "Ingresando…" y buscarlo otra vez por nombre ya no lo encontraría.
    const boton = entrar();
    fireEvent.click(boton);
    fireEvent.click(boton);
    fireEvent.click(boton);
    await waitFor(() => expect(boton).toBeDisabled());
    expect(boton.textContent).toMatch(/Ingresando/);
    expect(state.llamadas).toHaveLength(1);
    resolver({ error: null });
  });
});
