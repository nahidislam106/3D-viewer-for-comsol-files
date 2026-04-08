"use client";

import { useEffect, useRef, useState } from "react";

import type { ClipAxis, ColormapName } from "@/components/ControlsPanel";

type VTKViewerProps = {
  datasetUrl: string;
  activeScalar: string;
  colormap: ColormapName;
  scalarRangeMin: number;
  scalarRangeMax: number;
  showAxes: boolean;
  showBounds: boolean;
  clipEnabled: boolean;
  clipAxis: ClipAxis;
  clipPosition: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function toAbsoluteUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE}${url}`;
}

function applyColormap(
  lut: { removeAllPoints: () => void; addRGBPoint: (x: number, r: number, g: number, b: number) => void },
  map: ColormapName,
  min: number,
  max: number,
) {
  const start = Number.isFinite(min) ? min : 0;
  const end = Number.isFinite(max) && max > start ? max : start + 1;
  const mid = start + (end - start) * 0.5;
  const q1 = start + (end - start) * 0.25;
  const q3 = start + (end - start) * 0.75;

  lut.removeAllPoints();
  if (map === "Viridis") {
    lut.addRGBPoint(start, 0.267, 0.005, 0.329);
    lut.addRGBPoint(q1, 0.283, 0.141, 0.458);
    lut.addRGBPoint(mid, 0.254, 0.265, 0.53);
    lut.addRGBPoint(q3, 0.207, 0.51, 0.463);
    lut.addRGBPoint(end, 0.993, 0.906, 0.144);
    return;
  }

  if (map === "Cool to Warm") {
    lut.addRGBPoint(start, 0.231, 0.298, 0.753);
    lut.addRGBPoint(mid, 0.865, 0.865, 0.865);
    lut.addRGBPoint(end, 0.706, 0.016, 0.15);
    return;
  }

  if (map === "Grayscale") {
    lut.addRGBPoint(start, 0.05, 0.05, 0.05);
    lut.addRGBPoint(end, 0.95, 0.95, 0.95);
    return;
  }

  lut.addRGBPoint(start, 0.18, 0.0, 0.65);
  lut.addRGBPoint(q1, 0.0, 0.4, 1.0);
  lut.addRGBPoint(mid, 0.0, 0.83, 0.6);
  lut.addRGBPoint(q3, 0.98, 0.86, 0.07);
  lut.addRGBPoint(end, 0.9, 0.08, 0.08);
}

export default function VTKViewer({
  datasetUrl,
  activeScalar,
  colormap,
  scalarRangeMin,
  scalarRangeMax,
  showAxes,
  showBounds,
  clipEnabled,
  clipAxis,
  clipPosition,
}: VTKViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        setStatus("Initializing VTK...");
        setError(null);

        // Required profile registration for render pipeline internals.
        await import("vtk.js/Sources/Rendering/Profiles/Geometry");

        const GenericRenderWindow = (await import("vtk.js/Sources/Rendering/Misc/GenericRenderWindow")).default;
        const XMLPolyDataReader = (await import("vtk.js/Sources/IO/XML/XMLPolyDataReader")).default;
        const Mapper = (await import("vtk.js/Sources/Rendering/Core/Mapper")).default;
        const Actor = (await import("vtk.js/Sources/Rendering/Core/Actor")).default;
        const AxesActor = (await import("vtk.js/Sources/Rendering/Core/AxesActor")).default;
        const Cutter = (await import("vtk.js/Sources/Filters/Core/Cutter")).default;
        const Plane = (await import("vtk.js/Sources/Common/DataModel/Plane")).default;
        const OutlineFilter = (await import("vtk.js/Sources/Filters/General/OutlineFilter")).default;
        const ColorTransferFunction = (await import("vtk.js/Sources/Rendering/Core/ColorTransferFunction")).default;

        if (disposed) {
          return;
        }

        setStatus("Creating render window...");

        const renderWindow = GenericRenderWindow.newInstance({
          background: [0.03, 0.04, 0.07],
        });
        renderWindow.setContainer(containerRef.current);

        const renderer = renderWindow.getRenderer();
        const rw = renderWindow.getRenderWindow();

        setStatus("Fetching dataset...");

        const response = await fetch(toAbsoluteUrl(datasetUrl));
        if (!response.ok) {
          throw new Error(`Failed to fetch dataset: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        if (disposed) {
          return;
        }

        setStatus("Parsing VTK data...");

        const reader = XMLPolyDataReader.newInstance();
        reader.parseAsArrayBuffer(buffer);
        const dataset = reader.getOutputData(0);

        if (!dataset) {
          throw new Error("Failed to parse VTP dataset");
        }

        const mapper = Mapper.newInstance();
        mapper.setInputData(dataset);

        const pointData = dataset.getPointData();
        const pointNames = pointData
          .getArrays()
          .map((array: { getName: () => string }) => array.getName())
          .filter(Boolean);

        const cellData = dataset.getCellData();
        const cellNames = cellData
          .getArrays()
          .map((array: { getName: () => string }) => array.getName())
          .filter(Boolean);

        const selectedName = activeScalar || pointNames[0] || cellNames[0] || "";
        if (selectedName) {
          const lut = ColorTransferFunction.newInstance();
          const min = Number.isFinite(scalarRangeMin) ? scalarRangeMin : 0;
          const max = Number.isFinite(scalarRangeMax) && scalarRangeMax > min ? scalarRangeMax : min + 1;
          applyColormap(lut, colormap, min, max);

          if (pointNames.includes(selectedName)) {
            mapper.setScalarModeToUsePointFieldData();
          } else {
            mapper.setScalarModeToUseCellFieldData();
          }
          mapper.setColorByArrayName(selectedName);
          mapper.setLookupTable(lut);
          mapper.setScalarRange(min, max);
          mapper.setScalarVisibility(true);
          mapper.setUseLookupTableScalarRange(true);
        } else {
          mapper.setScalarVisibility(false);
        }

        const actor = Actor.newInstance();
        actor.setMapper(mapper);
        actor.getProperty().setColor(0.72, 0.8, 0.92);

        renderer.addActor(actor);

        const cutPlane = Plane.newInstance();
        const cutter = Cutter.newInstance();
        cutter.setInputData(dataset);
        cutter.setCutFunction(cutPlane);

        const cutMapper = Mapper.newInstance();
        cutMapper.setInputConnection(cutter.getOutputPort());
        if (selectedName) {
          if (pointNames.includes(selectedName)) {
            cutMapper.setScalarModeToUsePointFieldData();
          } else {
            cutMapper.setScalarModeToUseCellFieldData();
          }
          cutMapper.setColorByArrayName(selectedName);
          cutMapper.setLookupTable(mapper.getLookupTable());
          cutMapper.setScalarRange(mapper.getScalarRange());
          cutMapper.setScalarVisibility(true);
        } else {
          cutMapper.setScalarVisibility(false);
        }

        const cutActor = Actor.newInstance();
        cutActor.setMapper(cutMapper);
        cutActor.getProperty().setLineWidth(2);
        cutActor.getProperty().setColor(1, 0.55, 0.2);
        renderer.addActor(cutActor);

        const dsBounds = dataset.getBounds();
        const centers: [number, number, number] = [
          (dsBounds[0] + dsBounds[1]) * 0.5,
          (dsBounds[2] + dsBounds[3]) * 0.5,
          (dsBounds[4] + dsBounds[5]) * 0.5,
        ];
        const origin: [number, number, number] = [...centers];
        const normal: [number, number, number] = [1, 0, 0];

        if (clipAxis === "x") {
          normal[0] = 1;
          normal[1] = 0;
          normal[2] = 0;
          origin[0] = clipPosition;
        } else if (clipAxis === "y") {
          normal[0] = 0;
          normal[1] = 1;
          normal[2] = 0;
          origin[1] = clipPosition;
        } else {
          normal[0] = 0;
          normal[1] = 0;
          normal[2] = 1;
          origin[2] = clipPosition;
        }

        cutPlane.setOrigin(origin[0], origin[1], origin[2]);
        cutPlane.setNormal(normal[0], normal[1], normal[2]);
        actor.setVisibility(!clipEnabled);
        cutActor.setVisibility(clipEnabled);

        const outlineFilter = OutlineFilter.newInstance();
        outlineFilter.setInputData(dataset);
        const outlineMapper = Mapper.newInstance();
        outlineMapper.setInputConnection(outlineFilter.getOutputPort());
        const outlineActor = Actor.newInstance();
        outlineActor.setMapper(outlineMapper);
        outlineActor.getProperty().setColor(0.93, 0.93, 0.96);
        outlineActor.getProperty().setOpacity(0.55);
        outlineActor.setVisibility(showBounds);
        renderer.addActor(outlineActor);

        let axesActor: ReturnType<typeof AxesActor.newInstance> | null = null;
        if (showAxes) {
          axesActor = AxesActor.newInstance();
          renderer.addActor(axesActor);
        }

        renderer.resetCamera();
        rw.render();

        setStatus("");

        const handleResize = () => {
          renderWindow.resize();
          rw.render();
        };

        window.addEventListener("resize", handleResize);

        cleanup = () => {
          window.removeEventListener("resize", handleResize);
          if (axesActor) {
            axesActor.delete();
          }
          outlineActor.delete();
          outlineMapper.delete();
          outlineFilter.delete();
          cutActor.delete();
          cutMapper.delete();
          cutter.delete();
          cutPlane.delete();
          actor.delete();
          mapper.delete();
          reader.delete();
          renderWindow.delete();
        };
      } catch (viewerError) {
        const message =
          viewerError instanceof Error
            ? viewerError.message
            : "Viewer initialization failed";
        setError(message);
        setStatus("");
      }
    };

    void setup();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [datasetUrl, activeScalar, colormap, scalarRangeMin, scalarRangeMax, showAxes, showBounds, clipEnabled, clipAxis, clipPosition]);

  return (
    <section className="panel viewer-wrap">
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: 580 }}
      />
      {status && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            margin: 0,
            padding: "0.5rem 0.8rem",
            borderRadius: 8,
            background: "rgba(0, 104, 255, 0.12)",
            border: "1px solid rgba(0, 104, 255, 0.26)",
            color: "var(--accent)",
            fontSize: "0.9rem",
          }}
        >
          {status}
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            margin: 0,
            padding: "0.6rem 0.8rem",
            borderRadius: 8,
            background: "rgba(214, 59, 83, 0.12)",
            border: "1px solid rgba(214, 59, 83, 0.42)",
            color: "var(--danger)",
            fontSize: "0.9rem",
            maxWidth: "90%",
          }}
        >
          ⚠️ {error}
        </div>
      )}
    </section>
  );
}
