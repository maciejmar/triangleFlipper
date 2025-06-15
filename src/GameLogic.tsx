// src/GameLogic.tsx

import React, { useEffect, useRef } from 'react';

interface Particle   { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Ripple     { x: number; y: number; life: number }
interface Deformation{ x: number; y: number; life: number }
interface Point      { x: number; y: number }

const BASE_ROTATION_SPEED = 0.001;
const BALL_RADIUS         = 10;
const BASE_SPEED          = 2.7;           // 10% slower
const BOOST_FACTOR        = 4.5 / 2.7;     // so boost returns to ~4.5
const SPARK_COUNT         = 30;
const SPARK_LIFE          = 30;
const RIPPLE_LIFE         = 60;
const DEFORMATION_LIFE    = 30;

const FLIPPER_LEN         = 100;
const FLIPPER_TH          = 10;
const FLIPPER_GAP         = 20;
const MAX_FLIP_ANGLE      = Math.PI / 4;
const FLIP_SPEED          = 0.1;

interface GameLogicProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  timerRef: React.MutableRefObject<number>;
  ballX: React.MutableRefObject<number>;
  ballY: React.MutableRefObject<number>;
  ballVelX: React.MutableRefObject<number>;
  ballVelY: React.MutableRefObject<number>;
  isBoosted: React.MutableRefObject<boolean>;
  leftAngle: React.MutableRefObject<number>;
  rightAngle: React.MutableRefObject<number>;
  rotateLeft: React.MutableRefObject<boolean>;
  rotateRight: React.MutableRefObject<boolean>;
  rotation: React.MutableRefObject<number>;
  particles: React.MutableRefObject<Particle[]>;
  ripples: React.MutableRefObject<Ripple[]>;
  deformations: React.MutableRefObject<Deformation[]>;
  ballScale: React.MutableRefObject<number>;
  scoreSetter: React.Dispatch<React.SetStateAction<number>>;
  timerSetter: React.Dispatch<React.SetStateAction<number>>;
  setGameOver: React.Dispatch<React.SetStateAction<boolean>>;
}

const GameLogic: React.FC<GameLogicProps> = ({
  canvasRef, timerRef,
  ballX, ballY, ballVelX, ballVelY, isBoosted,
  leftAngle, rightAngle, rotateLeft, rotateRight, rotation,
  particles, ripples, deformations, ballScale,
  scoreSetter, timerSetter, setGameOver
}) => {
  const gameOverRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    // Triangle geometry
    const margin = Math.min(canvas.width, canvas.height) * 0.15;
    const maxW   = canvas.width  - 2 * margin;
    const maxH   = (canvas.height - 2 * margin) * 2 / Math.sqrt(3);
    const side   = Math.min(maxW, maxH);
    const height = Math.sqrt(3) / 2 * side;
    const A: Point = { x: (canvas.width - side) / 2, y: canvas.height - margin };
    const B: Point = { x: (canvas.width + side) / 2, y: canvas.height - margin };
    const C: Point = { x: canvas.width / 2, y: canvas.height - margin - height };
    const centroid = {
      x: (A.x + B.x + C.x) / 3,
      y: (A.y + B.y + C.y) / 3
    };
    const zone = side * 0.1;

    // Flipper pivots & slope angles
    const centerX         = canvas.width / 2;
    const leftPivot       = { x: centerX - (FLIPPER_LEN + FLIPPER_GAP/2), y: A.y - FLIPPER_TH/2 };
    const rightPivot      = { x: centerX + (FLIPPER_LEN + FLIPPER_GAP/2), y: A.y - FLIPPER_TH/2 };
    const leftSlopePivot  = { x: (A.x + C.x)/2, y: (A.y + C.y)/2 };
    const rightSlopePivot = { x: (B.x + C.x)/2, y: (B.y + C.y)/2 };
    const slopeAngleLeft  = Math.atan2(C.y - A.y, C.x - A.x);
    const slopeAngleRight = Math.atan2(C.y - B.y, C.x - B.x);

    // Launch ball
    const launchBall = () => {
      const ang = Math.random() * 2 * Math.PI;
      ballVelX.current = BASE_SPEED * Math.cos(ang);
      ballVelY.current = BASE_SPEED * Math.sin(ang);
      ballX.current = C.x;
      ballY.current = A.y - 60;
      ballScale.current = 1;
      isBoosted.current = false;
    };
    launchBall();

    // Reflect helper
    const reflect = (nx: number, ny: number) => {
      const d = ballVelX.current * nx + ballVelY.current * ny;
      ballVelX.current -= 2 * d * nx;
      ballVelY.current -= 2 * d * ny;
    };

    // Effects helper
    const createEffects = (x: number, y: number, color: string = 'yellow') => {
      for (let i = 0; i < SPARK_COUNT; i++) {
        const ang = Math.random() * 2 * Math.PI;
        const spd = Math.random() * 3 + 1;
        particles.current.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: SPARK_LIFE,
          color
        });
      }
      ripples.current.push({ x, y, life: RIPPLE_LIFE });
      deformations.current.push({ x, y, life: DEFORMATION_LIFE });
    };

    const triggerSquash = () => {
      ballScale.current = 1.5;
    };

    // Game timer
    timerRef.current = window.setInterval(() => {
      timerSetter(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          gameOverRef.current = true;
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // Keyboard controls
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  rotateLeft.current = true;
      if (e.key === 'ArrowRight') rotateRight.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  rotateLeft.current = false;
      if (e.key === 'ArrowRight') rotateRight.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Main loop
    const loop = () => {
      if (gameOverRef.current) return;  // stop everything after Game Over

      // Clear frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Rotate & draw triangle and zones
      rotation.current += BASE_ROTATION_SPEED;
      ctx.save();
      ctx.translate(centroid.x, centroid.y);
      ctx.rotate(rotation.current);
      ctx.translate(-centroid.x, -centroid.y);

      // Draw triangle
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'white';
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.closePath();
      ctx.stroke();

      // Draw zones
      ctx.fillStyle = 'green';
      ctx.beginPath();
      ctx.moveTo(C.x, C.y + 5);
      ctx.lineTo(C.x - zone/2, C.y + zone + 5);
      ctx.lineTo(C.x + zone/2, C.y + zone + 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'red';
      ctx.beginPath();
      const P1 = { x: B.x + (A.x - B.x)*(zone/side), y: B.y + (A.y - B.y)*(zone/side) };
      const P2 = { x: B.x + (C.x - B.x)*(zone/side), y: B.y + (C.y - B.y)*(zone/side) };
      ctx.moveTo(B.x, B.y);
      ctx.lineTo(P1.x, P1.y);
      ctx.lineTo(P2.x, P2.y);
      ctx.closePath();
      ctx.fill();

      // Draw flippers
      leftAngle.current  = rotateLeft.current  ? Math.min(MAX_FLIP_ANGLE, leftAngle.current  + FLIP_SPEED) : Math.max(0, leftAngle.current  - FLIP_SPEED);
      rightAngle.current = rotateRight.current ? Math.min(MAX_FLIP_ANGLE, rightAngle.current + FLIP_SPEED) : Math.max(0, rightAngle.current - FLIP_SPEED);

      // Bottom-left
      ctx.save();
      ctx.translate(leftPivot.x, leftPivot.y);
      ctx.rotate(-leftAngle.current);
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, -FLIPPER_TH/2, FLIPPER_LEN, FLIPPER_TH);
      ctx.restore();

      // Bottom-right
      ctx.save();
      ctx.translate(rightPivot.x, rightPivot.y);
      ctx.rotate(rightAngle.current);
      ctx.fillStyle = 'blue';
      ctx.fillRect(-FLIPPER_LEN, -FLIPPER_TH/2, FLIPPER_LEN, FLIPPER_TH);
      ctx.restore();

      // Slope-left
      ctx.save();
      ctx.translate(leftSlopePivot.x, leftSlopePivot.y);
      ctx.rotate(slopeAngleLeft + leftAngle.current);
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, -FLIPPER_TH/2, FLIPPER_LEN, FLIPPER_TH);
      ctx.restore();

      // Slope-right
      ctx.save();
      ctx.translate(rightSlopePivot.x, rightSlopePivot.y);
      ctx.rotate(slopeAngleRight + rightAngle.current);
      ctx.fillStyle = 'blue';
      ctx.fillRect(-FLIPPER_LEN, -FLIPPER_TH/2, FLIPPER_LEN, FLIPPER_TH);
      ctx.restore();

      ctx.restore();

      // Move ball
      ballX.current += ballVelX.current;
      ballY.current += ballVelY.current;

      // Squash easing
      ballScale.current += (1 - ballScale.current) * 0.2;

      // Edge collisions (segment-aware)
      ;[{ p1: A, p2: B }, { p1: B, p2: C }, { p1: C, p2: A }].forEach(({ p1, p2 }) => {
        const vx = p2.x - p1.x, vy = p2.y - p1.y;
        const len2 = vx*vx + vy*vy;
        if (!len2) return;
        const t = ((ballX.current - p1.x)*vx + (ballY.current - p1.y)*vy) / len2;
        if (t < 0 || t > 1) return;
        const projX = p1.x + t*vx, projY = p1.y + t*vy;
        const dx = ballX.current - projX, dy = ballY.current - projY;
        const dist2 = dx*dx + dy*dy;
        if (dist2 < BALL_RADIUS*BALL_RADIUS) {
          const dist = Math.sqrt(dist2) || 1;
          const nx = dx/dist, ny = dy/dist;
          reflect(nx, ny);
          const overlap = BALL_RADIUS - dist;
          ballX.current += nx * overlap;
          ballY.current += ny * overlap;
          const vlen = Math.hypot(ballVelX.current, ballVelY.current) || 1;
          ballVelX.current = (ballVelX.current / vlen) * BASE_SPEED;
          ballVelY.current = (ballVelY.current / vlen) * BASE_SPEED;
          isBoosted.current = false;
          triggerSquash();
          createEffects(ballX.current, ballY.current, 'cyan');
        }
      });

      // Flipper collisions (boost)
      ;[
        { pivot: leftPivot,  angle: -leftAngle.current },
        { pivot: rightPivot, angle:  rightAngle.current }
      ].forEach(({ pivot, angle }) => {
        const ux = Math.cos(angle), uy = Math.sin(angle);
        const end = { x: pivot.x + ux*FLIPPER_LEN, y: pivot.y + uy*FLIPPER_LEN };
        const vx = end.x - pivot.x, vy = end.y - pivot.y;
        const len2 = vx*vx + vy*vy;
        if (!len2) return;
        const t = ((ballX.current - pivot.x)*vx + (ballY.current - pivot.y)*vy) / len2;
        if (t < 0 || t > 1) return;
        const projX = pivot.x + t*vx, projY = pivot.y + t*vy;
        const dx = ballX.current - projX, dy = ballY.current - projY;
        if (dx*dx + dy*dy < BALL_RADIUS*BALL_RADIUS) {
          const dist = Math.hypot(dx,dy) || 1;
          const nx = dx/dist, ny = dy/dist;
          reflect(nx, ny);
          if (!isBoosted.current) {
            ballVelX.current *= BOOST_FACTOR;
            ballVelY.current *= BOOST_FACTOR;
            isBoosted.current = true;
          }
          triggerSquash();
          createEffects(ballX.current, ballY.current, '#ffcc5c');
        }
      });

      ;[
        { pivot: leftSlopePivot,  angle: slopeAngleLeft + leftAngle.current },
        { pivot: rightSlopePivot, angle: slopeAngleRight - rightAngle.current }
      ].forEach(({ pivot, angle }) => {
        const ux = Math.cos(angle), uy = Math.sin(angle);
        const end = { x: pivot.x + ux*FLIPPER_LEN, y: pivot.y + uy*FLIPPER_LEN };
        const vx = end.x - pivot.x, vy = end.y - pivot.y;
        const len2 = vx*vx + vy*vy;
        if (!len2) return;
        const t = ((ballX.current - pivot.x)*vx + (ballY.current - pivot.y)*vy) / len2;
        if (t < 0 || t > 1) return;
        const projX = pivot.x + t*vx, projY = pivot.y + t*vy;
        const dx = ballX.current - projX, dy = ballY.current - projY;
        if (dx*dx + dy*dy < BALL_RADIUS*BALL_RADIUS) {
          const dist = Math.hypot(dx,dy) || 1;
          const nx = dx/dist, ny = dy/dist;
          reflect(nx, ny);
          if (!isBoosted.current) {
            ballVelX.current *= BOOST_FACTOR;
            ballVelY.current *= BOOST_FACTOR;
            isBoosted.current = true;
          }
          triggerSquash();
          createEffects(ballX.current, ballY.current, 'yellow');
        }
      });

      // Particles
      particles.current = particles.current.filter(p => p.life > 0);
      particles.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life--;
        const alpha = Math.min(1, p.life / SPARK_LIFE * 0.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + Math.random()*2, 0, 2*Math.PI);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Ripples
      ripples.current = ripples.current.filter(r => r.life > 0);
      ripples.current.forEach(r => {
        const prog = 1 - r.life / RIPPLE_LIFE;
        const rad  = prog * zone;
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(218,165,32,${1 - prog - 0.4})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, 2*Math.PI);
        ctx.stroke();
        r.life--;
      });

      // Scoring
      if (
        ballY.current < C.y + zone + 5 &&
        ballY.current > C.y &&
        Math.abs(ballX.current - C.x) < zone/2
      ) {
        scoreSetter(s => s + 10);
        createEffects(ballX.current, ballY.current, 'lime');
      }
      if (
        ballX.current > B.x - zone &&
        ballY.current > B.y - zone
      ) {
        scoreSetter(s => s - 10);
        createEffects(ballX.current, ballY.current, 'red');
      }

      // Draw ball
      ctx.save();
      ctx.translate(ballX.current, ballY.current);
      ctx.scale(ballScale.current, ballScale.current);
      ctx.beginPath();
      ctx.arc(0, 0, BALL_RADIUS, 0, 2*Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
      ctx.restore();

      requestAnimationFrame(loop);
    };

    loop();

    return () => {
      clearInterval(timerRef.current!);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return null;
};

export default GameLogic;
