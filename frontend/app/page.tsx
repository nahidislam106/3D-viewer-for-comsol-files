import Link from "next/link";

export default function HomePage() {
  return (
    <main className="app-shell" style={{ placeItems: "center" }}>
      <section className="panel" style={{ maxWidth: 680, width: "100%", padding: "2rem" }}>
        <p className="badge">COMSOL-to-Web Pipeline</p>
        <h1 style={{ marginTop: "1rem", marginBottom: "0.6rem", fontSize: "2rem" }}>
          Simulation Viewer for MPH/VTK Data
        </h1>
        <p style={{ color: "var(--text-1)", lineHeight: 1.6 }}>
          Upload exported simulation files, run server-side conversion, and inspect geometry plus scalar
          fields in an interactive 3D viewport.
        </p>
        <div style={{ marginTop: "1.4rem" }}>
          <Link className="button" href="/upload">
            Start Upload
          </Link>
        </div>
      </section>
    </main>
  );
}
