import { useEffect, useRef } from "react";
import { actions } from "@/state/store";

const LOGO_SRC = "/prisma-logo.mp4?v=2";

/** Near-black pixels in the logo file are the backdrop, not part of the mark. */
function clearBackdrop(data: Uint8ClampedArray): void {
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] < 42 && data[index + 1] < 42 && data[index + 2] < 42) {
      data[index + 3] = 0;
    }
  }
}

function MotionLogo(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }
    let frame = 0;
    const draw = (): void => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
        }
        if (canvas.height !== video.videoHeight) {
          canvas.height = video.videoHeight;
        }
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          clearBackdrop(image.data);
          context.putImageData(image, 0, 0);
        }
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    void video.play().catch(() => undefined);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="empty-logo-frame">
      <video
        ref={videoRef}
        className="empty-logo-source"
        src={LOGO_SRC}
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        controls={false}
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="empty-logo" aria-label="Prisma" />
    </div>
  );
}

export function EmptyState(): JSX.Element {
  return (
    <div className="empty-state">
      <MotionLogo />
      <h2>No files loaded yet</h2>
      <p>
        Load a real folder from your computer, or explore a generated sample project to see how it works.
      </p>
      <div className="actions">
        <button className="primary" type="button" onClick={() => void actions.openFolder()}>
          Load folder
        </button>
        <button type="button" onClick={() => actions.loadSample()}>
          Try sample data
        </button>
      </div>
    </div>
  );
}
