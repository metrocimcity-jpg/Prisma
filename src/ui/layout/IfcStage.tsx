import { IfcAPI, type IfcGeometry } from "web-ifc";
import mtWasmUrl from "web-ifc/web-ifc-mt.wasm?url";
import wasmUrl from "web-ifc/web-ifc.wasm?url";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { IFC_VIEWS, frameView } from "@/ui/layout/ifcNavigation";

interface IfcStageProps {
  file: File;
  title: string;
}

function clusterBounds(group: THREE.Group): THREE.Box3 {
  const pieces: { center: THREE.Vector3; span: number; box: THREE.Box3 }[] = [];
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry.getAttribute("position")) {
      return;
    }
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingBox) {
      return;
    }
    const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    const size = box.getSize(new THREE.Vector3());
    pieces.push({
      center: box.getCenter(new THREE.Vector3()),
      span: Math.max(size.x, size.y, size.z),
      box,
    });
  });
  const all = new THREE.Box3();
  if (pieces.length === 0) {
    return all;
  }
  const middle = (values: number[]): number => values[Math.floor(values.length / 2)] ?? 0;
  const median = new THREE.Vector3(
    middle(pieces.map((piece) => piece.center.x).sort((a, b) => a - b)),
    middle(pieces.map((piece) => piece.center.y).sort((a, b) => a - b)),
    middle(pieces.map((piece) => piece.center.z).sort((a, b) => a - b)),
  );
  const distances = pieces.map((piece) => piece.center.distanceTo(median)).sort((a, b) => a - b);
  const limit = (distances[Math.floor(distances.length * 0.75)] ?? 1) * 1.5;
  let kept = 0;
  for (const piece of pieces) {
    if (piece.center.distanceTo(median) <= Math.max(limit, piece.span)) {
      all.union(piece.box);
      kept += 1;
    }
  }
  if (kept === 0) {
    for (const piece of pieces) {
      all.union(piece.box);
    }
  }
  return all;
}

function locateWasm(path: string): string {
  if (path.endsWith("web-ifc-mt.wasm")) {
    return mtWasmUrl;
  }
  if (path.endsWith(".wasm")) {
    return wasmUrl;
  }
  return path;
}

function bufferGeometry(api: IfcAPI, geometry: IfcGeometry): THREE.BufferGeometry | null {
  const vertices = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
  const indices = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
  geometry.delete();
  if (vertices.length < 6 || indices.length < 3) {
    return null;
  }
  const positions = new Float32Array(vertices.length / 2);
  const normals = new Float32Array(vertices.length / 2);
  for (let index = 0; index < vertices.length; index += 6) {
    const target = index / 2;
    positions[target] = vertices[index] ?? 0;
    positions[target + 1] = vertices[index + 1] ?? 0;
    positions[target + 2] = vertices[index + 2] ?? 0;
    normals[target] = vertices[index + 3] ?? 0;
    normals[target + 1] = vertices[index + 4] ?? 0;
    normals[target + 2] = vertices[index + 5] ?? 0;
  }
  const buffer = new THREE.BufferGeometry();
  buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  buffer.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  buffer.setIndex(new THREE.BufferAttribute(indices, 1));
  return buffer;
}

export function IfcStage({ file, title }: IfcStageProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Opening IFC…");
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    let cancelled = false;
    const api = new IfcAPI();
    let modelID = -1;
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#d5d8de");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomToCursor = true;
    controls.zoomSpeed = 0.85;
    controls.panSpeed = 0.65;
    controls.screenSpacePanning = true;
    controls.enableRotate = false;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;

    scene.add(new THREE.AmbientLight("#ffffff", 0.6));
    const key = new THREE.DirectionalLight("#ffffff", 1.2);
    key.position.set(0.35, 1, 0.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#ffffff", 0.35);
    fill.position.set(-0.5, 0.45, -0.2);
    scene.add(fill);

    const resize = (): void => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const canvas = renderer.domElement;
    let lastX = 0;
    let lastY = 0;
    const onOrbitMove = (event: PointerEvent): void => {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      const unit = (2 * Math.PI) / Math.max(canvas.clientHeight, 1);
      const polar = controls.getPolarAngle();
      const yawScale = 0.22 + 0.78 * Math.sin(Math.min(Math.max(polar, 0), Math.PI / 2));
      controls.rotateLeft(dx * unit * 0.38 * yawScale);
      controls.rotateUp(dy * unit * 0.38);
    };
    const onOrbitUp = (): void => {
      window.removeEventListener("pointermove", onOrbitMove);
      window.removeEventListener("pointerup", onOrbitUp);
    };
    const onOrbitDown = (event: PointerEvent): void => {
      if (event.button !== 0) {
        return;
      }
      onOrbitUp();
      lastX = event.clientX;
      lastY = event.clientY;
      window.addEventListener("pointermove", onOrbitMove);
      window.addEventListener("pointerup", onOrbitUp);
    };
    canvas.addEventListener("pointerdown", onOrbitDown);

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
    void (async () => {
      try {
        setFailed(null);
        setStatus("Opening IFC…");
        await api.Init(locateWasm, true);
        if (cancelled) {
          return;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (cancelled) {
          return;
        }
        setStatus("Reading geometry…");
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        if (cancelled) {
          return;
        }
        modelID = api.OpenModel(bytes);
        if (modelID < 0) {
          throw new Error("web-ifc could not open this file.");
        }
        const meshes = api.LoadAllGeometry(modelID);
        const group = new THREE.Group();
        const geometryCache = new Map<number, THREE.BufferGeometry>();
        const materialCache = new Map<string, THREE.MeshLambertMaterial>();
        for (let meshIndex = 0; meshIndex < meshes.size(); meshIndex += 1) {
          const flat = meshes.get(meshIndex);
          const placed = flat.geometries;
          for (let placedIndex = 0; placedIndex < placed.size(); placedIndex += 1) {
            const item = placed.get(placedIndex);
            if (item.flatTransformation.length !== 16) {
              continue;
            }
            let geometry = geometryCache.get(item.geometryExpressID);
            if (!geometry) {
              const source = api.GetGeometry(modelID, item.geometryExpressID);
              const built = bufferGeometry(api, source);
              if (!built) {
                continue;
              }
              geometry = built;
              geometryCache.set(item.geometryExpressID, geometry);
              geometries.push(geometry);
            }
            const opacity = item.color.w > 0.01 ? item.color.w : 1;
            const colorKey = `${item.color.x.toFixed(3)}|${item.color.y.toFixed(3)}|${item.color.z.toFixed(3)}|${opacity.toFixed(3)}`;
            let material = materialCache.get(colorKey);
            if (!material) {
              material = new THREE.MeshLambertMaterial({
                color: new THREE.Color(item.color.x, item.color.y, item.color.z),
                opacity,
                transparent: opacity < 0.99,
                side: THREE.DoubleSide,
              });
              materialCache.set(colorKey, material);
              materials.push(material);
            }
            const mesh = new THREE.Mesh(geometry, material);
            mesh.matrixAutoUpdate = false;
            mesh.matrix.fromArray(item.flatTransformation);
            group.add(mesh);
          }
          if (typeof flat.delete === "function") {
            flat.delete();
          }
        }
        const meshList = meshes as { delete?: () => void };
        if (typeof meshList.delete === "function") {
          meshList.delete();
        }
        if (cancelled) {
          return;
        }
        if (group.children.length === 0) {
          setFailed("This IFC has no 3D geometry to show.");
          setStatus("");
          return;
        }
        scene.add(group);
        group.rotation.x = -Math.PI / 2;
        group.updateMatrixWorld(true);
        const box = clusterBounds(group);
        if (box.isEmpty()) {
          setFailed("This IFC has no visible geometry.");
          setStatus("");
          return;
        }
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        group.position.set(-center.x, -center.y, -center.z);
        group.updateMatrixWorld(true);
        const modelSize = { x: size.x, y: size.y, z: size.z };
        const aspect = Math.max(camera.aspect, 0.25);
        let farthest = 1;
        for (const view of IFC_VIEWS) {
          farthest = Math.max(farthest, frameView(view, modelSize, aspect, camera.fov).distance);
        }
        controls.minDistance = Math.max(Math.min(size.x, size.y, size.z) / 80, 0.05);
        controls.maxDistance = farthest * 8;
        const top = frameView("top", modelSize, aspect, camera.fov);
        camera.near = Math.max(controls.minDistance / 10, 0.01);
        camera.far = farthest * 20;
        camera.up.set(0, 1, 0);
        camera.position.set(top.position.x, top.position.y, top.position.z);
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();
        setStatus("");
      } catch (error) {
        if (!cancelled) {
          setFailed(error instanceof Error ? error.message : "Could not preview this IFC");
          setStatus("");
        }
      }
    })();

    return () => {
      cancelled = true;
      canvas.removeEventListener("pointerdown", onOrbitDown);
      window.removeEventListener("pointermove", onOrbitMove);
      window.removeEventListener("pointerup", onOrbitUp);
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      if (modelID >= 0) {
        try {
          api.CloseModel(modelID);
        } catch {
          // The model is already closed when parsing was cancelled mid-load.
        }
      }
      try {
        api.Dispose();
      } catch {
        // Init may not have finished.
      }
    };
  }, [file]);

  return (
    <div className="ifc-stage">
      <div className="ifc-viewport" ref={hostRef} aria-label={`Preview of ${title}`}>
        {status || failed ? <p className="ifc-status">{failed ?? status}</p> : null}
      </div>
      <div className="ifc-hint">
        <span>Left-drag to orbit. Scroll to zoom. Middle or right-drag to pan.</span>
      </div>
    </div>
  );
}
