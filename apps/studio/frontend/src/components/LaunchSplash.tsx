import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { PARSEWRIGHT_LOGO_MARK_PATH, PARSEWRIGHT_LOGO_MARK_VIEWBOX } from "../assets/parsewrightLogoMark";

interface LaunchSplashProps {
  onComplete: () => void;
}

const INTRO_DURATION_MS = 2200;
const LOGO_SCALE = 0.5;

export function LaunchSplash({ onComplete }: LaunchSplashProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svgPath.setAttribute("d", PARSEWRIGHT_LOGO_MARK_PATH);

    const path = new Path2D(PARSEWRIGHT_LOGO_MARK_PATH);
    const pathLength = svgPath.getTotalLength();
    let frameId = 0;
    let startTime = 0;
    let completed = false;

    const resizeCanvas = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.round(clientWidth * dpr);
      canvas.height = Math.round(clientHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const easeOutCubic = (value: number): number => 1 - Math.pow(1 - value, 3);
    const easeInOutCubic = (value: number): number =>
      value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

    const render = (timestamp: number): void => {
      if (startTime === 0) startTime = timestamp;

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / INTRO_DURATION_MS, 1);
      const revealProgress = easeInOutCubic(Math.min(progress / 0.72, 1));
      const fillProgress = Math.max(0, (progress - 0.35) / 0.42);
      const settledProgress = Math.max(0, (progress - 0.72) / 0.28);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      context.clearRect(0, 0, width, height);

      const glowRadius = Math.max(width, height) * (0.34 + 0.1 * (1 - progress));
      const glow = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, glowRadius);
      glow.addColorStop(0, `rgba(209, 59, 114, ${0.2 * (1 - progress * 0.35)})`);
      glow.addColorStop(0.46, "rgba(242, 238, 231, 0.07)");
      glow.addColorStop(1, "rgba(20, 20, 19, 0)");

      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(width / 2, height / 2);

      const stageWidth = Math.min(width * 0.28, 260);
      const stageHeight = Math.min(height * 0.34, 300);
      const baseScale = Math.min(
        stageWidth / PARSEWRIGHT_LOGO_MARK_VIEWBOX.width,
        stageHeight / PARSEWRIGHT_LOGO_MARK_VIEWBOX.height
      );
      const bloomScale = 0.92 + 0.08 * easeOutCubic(Math.min(progress / 0.4, 1));
      const settleScale = 1 - 0.018 * easeOutCubic(settledProgress);

      context.scale(baseScale * LOGO_SCALE * bloomScale * settleScale, baseScale * LOGO_SCALE * bloomScale * settleScale);
      context.translate(-PARSEWRIGHT_LOGO_MARK_VIEWBOX.width / 2, -PARSEWRIGHT_LOGO_MARK_VIEWBOX.height / 2);

      context.fillStyle = `rgba(209, 59, 114, ${0.06 + fillProgress * 0.94})`;
      context.shadowColor = "rgba(209, 59, 114, 0.26)";
      context.shadowBlur = 22 + 20 * fillProgress;
      context.fill(path, "evenodd");

      context.shadowBlur = 0;
      context.lineWidth = 10;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.strokeStyle = "#d13b72";
      context.setLineDash([pathLength]);
      context.lineDashOffset = pathLength * (1 - revealProgress);
      context.stroke(path);
      context.restore();

      if (progress < 1) {
        frameId = window.requestAnimationFrame(render);
        return;
      }

      if (!completed) {
        completed = true;
        onComplete();
      }
    };

    resizeCanvas();
    frameId = window.requestAnimationFrame(render);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [onComplete]);

  return (
    <div className="launch-splash" aria-hidden="true">
      <canvas ref={canvasRef} className="launch-splash__canvas" />
    </div>
  );
}
