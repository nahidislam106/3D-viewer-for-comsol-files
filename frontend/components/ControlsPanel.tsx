"use client";

type ScalarMeta = {
  name: string;
  association: "point" | "cell";
  min: number;
  max: number;
};

type DatasetStats = {
  points: number;
  cells: number;
  bounds: number[];
};

type ControlsPanelProps = {
  scalars: ScalarMeta[];
  activeScalar: string;
  onScalarChange: (name: string) => void;
  showAxes: boolean;
  onToggleAxes: (next: boolean) => void;
  showBounds: boolean;
  onToggleBounds: (next: boolean) => void;
  stats: DatasetStats | null;
};

export default function ControlsPanel({
  scalars,
  activeScalar,
  onScalarChange,
  showAxes,
  onToggleAxes,
  showBounds,
  onToggleBounds,
  stats,
}: ControlsPanelProps) {
  const currentScalar = scalars.find((entry) => entry.name === activeScalar) ?? null;

  return (
    <aside className="panel" style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
      <div>
        <h2 style={{ marginTop: 0, marginBottom: "0.3rem", fontSize: "1.05rem" }}>Scene Controls</h2>
        <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.9rem" }}>
          Left drag: rotate | Right drag: pan | Wheel: zoom
        </p>
      </div>

      <div>
        <label htmlFor="scalar" style={{ display: "block", marginBottom: "0.35rem" }}>
          Scalar Field
        </label>
        <select
          id="scalar"
          className="select"
          value={activeScalar}
          onChange={(event) => onScalarChange(event.target.value)}
        >
          <option value="">None</option>
          {scalars.map((scalar) => (
            <option key={scalar.name} value={scalar.name}>
              {scalar.name} ({scalar.association})
            </option>
          ))}
        </select>
      </div>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input type="checkbox" checked={showAxes} onChange={(event) => onToggleAxes(event.target.checked)} />
        Show axes
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input type="checkbox" checked={showBounds} onChange={(event) => onToggleBounds(event.target.checked)} />
        Show bounding box
      </label>

      <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.8rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.4rem", fontSize: "0.98rem" }}>Analysis</h3>
        {currentScalar ? (
          <p className="mono" style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-1)" }}>
            min={currentScalar.min.toExponential(3)} max={currentScalar.max.toExponential(3)}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-1)" }}>Select a scalar to inspect range.</p>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.8rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.4rem", fontSize: "0.98rem" }}>Dataset Summary</h3>
        {stats ? (
          <div className="mono" style={{ fontSize: "0.86rem", color: "var(--text-1)", display: "grid", gap: "0.35rem" }}>
            <span>points: {stats.points.toLocaleString()}</span>
            <span>cells: {stats.cells.toLocaleString()}</span>
            <span>bounds: [{stats.bounds.map((v) => v.toFixed(2)).join(", ")}]</span>
          </div>
        ) : (
          <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.88rem" }}>No stats available.</p>
        )}
      </div>
    </aside>
  );
}
