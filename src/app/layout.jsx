import "./globals.css";

export const metadata = {
  title: "Clientes - Impresión",
  description: "Login interno",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
