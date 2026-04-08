import Link from "next/link";

export default function HomePage() {
  return (
    <main className="app-shell" style={{ placeItems: "center" }}>
      <section className="panel hero" style={{ maxWidth: 980, width: "100%" }}>
        <p className="badge">COMSOL-to-Web Pipeline</p>
        <h1 className="hero-title">Simulation Viewer for Engineering Data</h1>
        <p className="hero-subtitle">
          Upload exported simulation files, run server-side conversion, and inspect geometry plus scalar
          fields in an interactive 3D viewport.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/upload">
            Start Upload
          </Link>
          <Link className="button ghost" href="/viewer/22fae29d0d7f4c089012753d0fc40b8d">
            Open Example Scene
          </Link>
        </div>
        <div className="feature-grid" style={{ marginTop: "0.4rem" }}>
          <article className="feature-card">
            <h3>Fast Upload Pipeline</h3>
            <p>Drag and drop large VTK files and stream them directly to backend storage.</p>
          </article>
          <article className="feature-card">
            <h3>In-Browser 3D</h3>
            <p>Rotate, zoom, and inspect scalar fields with vtk.js rendering on the web.</p>
          </article>
          <article className="feature-card">
            <h3>History and Reopen</h3>
            <p>Recent uploads stay available so teams can revisit simulation outputs quickly.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
