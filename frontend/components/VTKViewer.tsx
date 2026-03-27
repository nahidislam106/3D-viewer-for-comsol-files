"use client";

import { useEffect, useRef, useState } from "react";

type VTKViewerProps = {
  datasetUrl: string;
  activeScalar: string;
  showAxes: boolean;
  showBounds: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function toAbsoluteUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE}${url}`;
}

export default function VTKViewer({ datasetUrl, activeScalar, showAxes, showBounds }: VTKViewerProps) {
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
          lut.addRGBPoint(0, 0.11, 0.22, 0.95);
          lut.addRGBPoint(0.5, 0.18, 0.92, 0.61);
          lut.addRGBPoint(1, 0.96, 0.17, 0.15);

          if (pointNames.includes(selectedName)) {
            mapper.setScalarModeToUsePointFieldData();
          } else {
            mapper.setScalarModeToUseCellFieldData();
          }
          mapper.setColorByArrayName(selectedName);
          mapper.setLookupTable(lut);
          mapper.setScalarVisibility(true);
          mapper.setUseLookupTableScalarRange(true);
        } else {
          mapper.setScalarVisibility(false);
        }

        const actor = Actor.newInstance();
        actor.setMapper(mapper);
        actor.getProperty().setColor(0.72, 0.8, 0.92);

        renderer.addActor(actor);

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
  }, [datasetUrl, activeScalar, showAxes, showBounds]);

  return (
    <section
      className="panel"
      style={{ position: "relative", minHeight: 580, overflow: "hidden" }}
    >
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
            background: "rgba(49, 211, 167, 0.1)",
            border: "1px solid rgba(49, 211, 167, 0.3)",
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
            background: "rgba(30, 12, 12, 0.9)",
            border: "1px solid rgba(255,127,127,0.5)",
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
