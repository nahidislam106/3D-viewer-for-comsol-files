"use client";

export type ColormapName = "Rainbow" | "Viridis" | "Cool to Warm" | "Grayscale";
export type ClipAxis = "x" | "y" | "z";

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
  colormap: ColormapName;
  onColormapChange: (name: ColormapName) => void;
  scalarRangeMin: number;
  scalarRangeMax: number;
  onRangeMinChange: (value: number) => void;
  onRangeMaxChange: (value: number) => void;
  onResetRange: () => void;
  showAxes: boolean;
  onToggleAxes: (next: boolean) => void;
  showBounds: boolean;
  onToggleBounds: (next: boolean) => void;
  clipEnabled: boolean;
  onToggleClipEnabled: (next: boolean) => void;
  clipAxis: ClipAxis;
  onClipAxisChange: (axis: ClipAxis) => void;
  clipPosition: number;
  onClipPositionChange: (value: number) => void;
  clipBounds: { min: number; max: number } | null;
  stats: DatasetStats | null;
};

export default function ControlsPanel({
  scalars,
  activeScalar,
  onScalarChange,
  colormap,
  onColormapChange,
  scalarRangeMin,
  scalarRangeMax,
  onRangeMinChange,
  onRangeMaxChange,
  onResetRange,
  showAxes,
  onToggleAxes,
  showBounds,
  onToggleBounds,
  clipEnabled,
  onToggleClipEnabled,
  clipAxis,
  onClipAxisChange,
  clipPosition,
  onClipPositionChange,
  clipBounds,
  stats,
}: ControlsPanelProps) {
  const currentScalar = scalars.find((entry) => entry.name === activeScalar) ?? null;

  return (
    <aside className="panel stack" style={{ padding: "1rem" }}>
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

      <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.8rem", display: "grid", gap: "0.6rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.98rem" }}>Colormap</h3>
        <select
          className="select"
          value={colormap}
          onChange={(event) => onColormapChange(event.target.value as ColormapName)}
        >
          <option value="Rainbow">Rainbow</option>
          <option value="Viridis">Viridis</option>
          <option value="Cool to Warm">Cool to Warm</option>
          <option value="Grayscale">Grayscale</option>
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
            Min
            <input
              className="input mono"
              type="number"
              step="any"
              value={Number.isFinite(scalarRangeMin) ? scalarRangeMin : 0}
              onChange={(event) => onRangeMinChange(Number(event.target.value))}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
            Max
            <input
              className="input mono"
              type="number"
              step="any"
              value={Number.isFinite(scalarRangeMax) ? scalarRangeMax : 1}
              onChange={(event) => onRangeMaxChange(Number(event.target.value))}
            />
          </label>
        </div>

        <button type="button" className="button ghost" onClick={onResetRange}>
          Reset Range
        </button>
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

      <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.8rem", display: "grid", gap: "0.6rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.98rem" }}>Clip Plane</h3>
        <button
          type="button"
          className="button"
          style={{ background: clipEnabled ? "linear-gradient(120deg, var(--accent-3), var(--accent))" : undefined }}
          onClick={() => onToggleClipEnabled(!clipEnabled)}
        >
          {clipEnabled ? "Disable Clip Plane" : "Enable Clip Plane"}
        </button>

        <div style={{ display: "grid", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>Axis</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.45rem" }}>
            {(["x", "y", "z"] as ClipAxis[]).map((axis) => (
              <button
                key={axis}
                type="button"
                className="button ghost"
                style={{
                  padding: "0.5rem 0.6rem",
                  background: clipAxis === axis ? "linear-gradient(120deg, var(--accent), var(--accent-2))" : undefined,
                  color: clipAxis === axis ? "#fff" : undefined,
                }}
                onClick={() => onClipAxisChange(axis)}
              >
                {axis.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
            Position {clipBounds ? `(${clipBounds.min.toFixed(2)} to ${clipBounds.max.toFixed(2)})` : ""}
          </span>
          <input
            type="range"
            min={clipBounds?.min ?? 0}
            max={clipBounds?.max ?? 1}
            step={clipBounds ? Math.max((clipBounds.max - clipBounds.min) / 500, 0.001) : 0.01}
            value={clipPosition}
            disabled={!clipBounds}
            onChange={(event) => onClipPositionChange(Number(event.target.value))}
          />
          <span className="mono" style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
            {clipPosition.toFixed(3)}
          </span>
        </label>
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
