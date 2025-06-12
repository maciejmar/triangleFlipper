// App.tsx

import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Game constants
const GAME_DURATION = 30;
const LEVEL_SCORE_THRESHOLD = 30;
const BASE_ROTATION_SPEED = 0.001;
const BALL_RADIUS = 10;
const BASE_SPEED = 3;        // constant ball speed
const BOOST_FACTOR = 1.5;    // flipper boost multiplier
const GRAVITY = 0.05;        // half-strength gravity
const SPARK_COUNT = 30;
const SPARK_LIFE = 30;
const RIPPLE_LIFE = 60;
const DEFORMATION_LIFE = 30;

// Flipper constants
const FLIPPER_LEN = 100;
const FLIPPER_TH = 10;
const FLIPPER_GAP = 20;
const MAX_FLIP_ANGLE = Math.PI / 4;
const FLIP_SPEED = 0.1;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
interface Ripple   { x: number; y: number; life: number; }
interface Deformation { x: number; y: number; life: number; }
interface Point { x: number; y: number; }
type PointTuple=[Point, number]

const App: React.FC = () => {
  // UI state
  const [score, setScore] = useState<number>(0);

  const [levelScore, setLevelScore] = useState<number>(0);
  const [timer, setTimer] = useState(GAME_DURATION);
  const [level, setLevel] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<number>(0);
  const ballX = useRef(0);
  const ballY = useRef(0);
  const ballVelX = useRef(0);
  const ballVelY = useRef(0);
  const isBoosted = useRef(false);

  const leftAngle = useRef(0);
  const rightAngle = useRef(0);
  const rotateLeft = useRef(false);
  const rotateRight = useRef(false);
  const rotation = useRef(0);

  const particles = useRef<Particle[]>([]);
  const ripples = useRef<Ripple[]>([]);
  const deformations = useRef<Deformation[]>([]);
  const ballScale = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Triangle geometry
    const margin = Math.min(canvas.width, canvas.height) * 0.15;
    const maxW = canvas.width - 2 * margin;
    const maxH = (canvas.height - 2 * margin) * 2 / Math.sqrt(3);
    const side = Math.min(maxW, maxH);
    const height = (Math.sqrt(3) / 2) * side;
    const A = { x: (canvas.width - side) / 2, y: canvas.height - margin };
    const B = { x: (canvas.width + side) / 2, y: canvas.height - margin };
    const C = { x: canvas.width / 2, y: canvas.height - margin - height };
    const centroid = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    const zone = side * 0.1;

    // Bottom flippers pivot
    const centerX = canvas.width / 2;
    const leftPivot  = { x: centerX - (FLIPPER_LEN + FLIPPER_GAP/2), y: A.y - FLIPPER_TH/2 };
    const rightPivot = { x: centerX + (FLIPPER_LEN + FLIPPER_GAP/2), y: A.y - FLIPPER_TH/2 };

    // Side flipper pivots: midpoint of AC and BC, pivot at top edge of flipper
    const leftSlopePivot  = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
    const rightSlopePivot = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
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

    // Game timer
    timerRef.current = window.setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setIsGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // Controls
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') rotateLeft.current = true;
      if (e.key === 'ArrowRight') rotateRight.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') rotateLeft.current = false;
      if (e.key === 'ArrowRight') rotateRight.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

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
        particles.current.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: SPARK_LIFE, color });
      }
      ripples.current.push({ x, y, life: RIPPLE_LIFE });
      deformations.current.push({ x, y, life: DEFORMATION_LIFE });
    };
    const triggerSquash = () => { ballScale.current = 1.5; };

      // Rounded-rect helper: only for flippers
    // Main loop
    const loop = () => {
      if (level > 1) rotation.current += BASE_ROTATION_SPEED * (level - 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(centroid.x, centroid.y);
      ctx.rotate(rotation.current);
      ctx.translate(-centroid.x, -centroid.y);

      // Draw triangle
      ctx.lineWidth = 5; ctx.strokeStyle = 'white';
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.closePath();
      ctx.stroke();

      // Dents
      // deformations.current = deformations.current.filter(d => d.life > 0);
      // deformations.current.forEach(d => {
      //   const a = d.life / DEFORMATION_LIFE, r = zone * a;
      //   ctx.fillStyle = `rgba(200,200,200,${a})`;
      //   ctx.beginPath();
      //   ctx.arc(d.x, d.y, r, 0, 2 * Math.PI);
      //   ctx.fill();
      //   d.life--;
      // });

      // Zones
      ctx.fillStyle = 'green';
      ctx.beginPath();
      ctx.moveTo(C.x, C.y + 5);
      ctx.lineTo(C.x - zone / 2, C.y + zone + 5);
      ctx.lineTo(C.x + zone / 2, C.y + zone + 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'red';
      ctx.beginPath();
      const P1 = { x: B.x + (A.x - B.x) * (zone / side), y: B.y + (A.y - B.y) * (zone / side) };
      const P2 = { x: B.x + (C.x - B.x) * (zone / side), y: B.y + (C.y - B.y) * (zone / side) };
      ctx.moveTo(B.x, B.y);
      ctx.lineTo(P1.x, P1.y);
      ctx.lineTo(P2.x, P2.y);
      ctx.closePath();
      ctx.fill();

      // Update flipper angles
      leftAngle.current  = rotateLeft.current  ? Math.min(MAX_FLIP_ANGLE, leftAngle.current + FLIP_SPEED)  : Math.max(0, leftAngle.current - FLIP_SPEED);
      rightAngle.current = rotateRight.current ? Math.min(MAX_FLIP_ANGLE, rightAngle.current + FLIP_SPEED) : Math.max(0, rightAngle.current - FLIP_SPEED);

      // Bottom-left flipper
      ctx.save();
      ctx.translate(leftPivot.x, leftPivot.y);
      ctx.rotate(-leftAngle.current);
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, -FLIPPER_TH / 2, FLIPPER_LEN, FLIPPER_TH);
      ctx.restore();

      // Bottom-right flipper
      ctx.save();
      ctx.translate(rightPivot.x, rightPivot.y);
      ctx.rotate(rightAngle.current);
      ctx.fillStyle = 'blue';
      ctx.fillRect(-FLIPPER_LEN, -FLIPPER_TH / 2, FLIPPER_LEN, FLIPPER_TH);
      ctx.restore();

      // Left-slope flipper pivot at A
      ctx.save();
      ctx.translate(leftSlopePivot.x, leftSlopePivot.y);
      ctx.rotate(slopeAngleLeft + leftAngle.current);
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, -FLIPPER_TH / 2, FLIPPER_LEN, FLIPPER_TH);
      ctx.restore();

      // Right-slope flipper pivot at B
      ctx.save();
      ctx.translate(rightSlopePivot.x, rightSlopePivot.y);
      ctx.rotate(slopeAngleRight + rightAngle.current);
      ctx.fillStyle = 'blue';
      ctx.fillRect(-FLIPPER_LEN, -FLIPPER_TH / 2, FLIPPER_LEN, FLIPPER_TH);
      ctx.restore();

      // Gravity and move ball
      ballVelY.current += GRAVITY;
      ballX.current += ballVelX.current;
      ballY.current += ballVelY.current;

      // Ball squash easing
      ballScale.current += (1 - ballScale.current) * 0.2;

      // Edge bounce (reset boost)
      [{ p1: A, p2: B }, { p1: B, p2: C }, { p1: C, p2: A }].forEach(({ p1, p2 }) => {
        const dx = p2.x - p1.x, dy = p2.y - p1.y, l = Math.hypot(dx, dy) || 1;
        const nx = dy / l, ny = -dx / l;
        const dist = nx * ballX.current + ny * ballY.current - (nx * p1.x + ny * p1.y);
        if (dist < BALL_RADIUS) {
          reflect(nx, ny);
          ballX.current += (BALL_RADIUS - dist) * nx;
          ballY.current += (BALL_RADIUS - dist) * ny;
          const vlen = Math.hypot(ballVelX.current, ballVelY.current) || 1;
          ballVelX.current = (ballVelX.current / vlen) * BASE_SPEED;
          ballVelY.current = (ballVelY.current / vlen) * BASE_SPEED;
          isBoosted.current = false;
          triggerSquash();
          createEffects(ballX.current, ballY.current, 'cyan');
        }
      });

      // Bottom flipper bounce (boost)
      const bottomFlippers: PointTuple[] = [[leftPivot, -leftAngle.current], [rightPivot, rightAngle.current]]; // Add this line
      bottomFlippers.forEach(([pivot, θ]) => { // Modify this line to use bottomFlippers
        const dx = ballX.current - pivot.x, dy = ballY.current - pivot.y;
        if (Math.hypot(dx, dy) < FLIPPER_LEN) {
          const ux = Math.cos(θ), uy = Math.sin(θ);
          const nx = uy, ny = -ux;
          reflect(nx, ny);
          if (!isBoosted.current) {
            ballVelX.current *= BOOST_FACTOR;
            ballVelY.current *= BOOST_FACTOR;
            isBoosted.current = true;
          }
          triggerSquash();
          createEffects(ballX.current, ballY.current, "#ffcc5c");
        }
      });

      // Slope flipper bounce (boost)
      const slopeFlippers: PointTuple[] = [[leftSlopePivot, slopeAngleLeft + leftAngle.current], [rightSlopePivot, slopeAngleRight - rightAngle.current]]; // Add this line
      slopeFlippers.forEach(([pivot, θ]: PointTuple) => { // Modify this line to use slopeFlippers and add PointTuple type annotation
        const dx = ballX.current - pivot.x, dy = ballY.current - pivot.y;
        if (Math.hypot(dx, dy) < FLIPPER_LEN) {
          const ux = Math.cos(θ), uy = Math.sin(θ);
          const nx = uy, ny = -ux;
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
        const base = p.life / (SPARK_LIFE);
        ctx.globalAlpha = Math.min(1, base * 0.5);  // max opacity 70%
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 + Math.random() * 2, 0, 2 * Math.PI); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Ripples
      ripples.current = ripples.current.filter(r => r.life > 0);
      ripples.current.forEach(r => {
        const prog = 1 - r.life / RIPPLE_LIFE;
        const rad = prog * zone * 1;
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(218,165,32,${1 - prog-0.4})`;
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 2 * Math.PI); ctx.stroke();
        r.life--;
      });

      // Scoring
      if (
        ballY.current < C.y + zone + 5 &&
        ballY.current > C.y &&
        Math.abs(ballX.current - C.x) < zone / 2
      ) {
        setScore(s => s + 10);
        setLevelScore(s => s + 10);
        createEffects(ballX.current, ballY.current, 'lime');
      }
      if (
        ballX.current > B.x - zone &&
        ballY.current > B.y - zone
      ) {
        setScore(s => s - 10);
        setLevelScore(s => s - 10);
        createEffects(ballX.current, ballY.current, 'red');
      }

      // Draw ball
      ctx.save();
      ctx.translate(ballX.current, ballY.current);
      ctx.scale(ballScale.current, ballScale.current);
      ctx.beginPath(); ctx.arc(0, 0, BALL_RADIUS, 0, 2 * Math.PI); ctx.fillStyle = 'red'; ctx.fill();
      ctx.restore();

      ctx.restore();
      if (!isGameOver) requestAnimationFrame(loop);
    };

    loop();
    return () => {
      clearInterval(timerRef.current!);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [level, isGameOver]);

  // Level progression
  useEffect(() => {
    if (levelScore >= LEVEL_SCORE_THRESHOLD && timer > 0) {
      setLevel(l => l + 1);
      setLevelScore(0);
      setTimer(GAME_DURATION);
    }
  }, [levelScore, timer]);

  // Button style & placement
  const buttonMargin = Math.min(window.innerWidth, window.innerHeight) * 0.15;
  const btnStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '10px',
    padding: '12px 28px',
    fontSize: 18,
    fontWeight: 600,
    color: '#ffe4f1',
    background: 'radial-gradient(circle at 30% 30%, #ff7eb9, #ff65a3)',
    border: 'none',
    borderRadius: 50,
    boxShadow: '0 4px 12px rgba(255,101,163,0.6), inset 0 -2px 6px rgba(255,101,163,0.4)',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    outline: 'none',
    overflow: 'hidden'
  };

  return (
    <div className="game-container">
      <div className="game-info">
        <div>Total Score: {score}</div>
        <div>Level: {level}</div>
        <div>Time Left: {timer}s</div>
      </div>
      <canvas ref={canvasRef} className="game-canvas" />

      <button
        className="flipper-btn"
        style={{ ...btnStyle, left: `${buttonMargin}px` }}
        onMouseDown={() => (rotateLeft.current = true)}
        onMouseUp={() => (rotateLeft.current = false)}
        onMouseLeave={() => (rotateLeft.current = false)}
      >
        Left
      </button>
      <button
        className="flipper-btn"
        style={{ ...btnStyle, right: `${buttonMargin}px` }}
        onMouseDown={() => (rotateRight.current = true)}
        onMouseUp={() => (rotateRight.current = false)}
        onMouseLeave={() => (rotateRight.current = false)}
      >
        Right
      </button>

      {isGameOver && (
        <div className="game-over">
          <h2>Game Over</h2>
          <p>Your final score: {score}</p>
        </div>
      )}
    </div>
  );
};

export default App;
