// src/App.tsx

import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import GameLogic from './GameLogic';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
interface Ripple   { x: number; y: number; life: number; }
interface Deformation { x: number; y: number; life: number; }
interface Fog { x: number; y: number; w: number; h: number; speed: number; }

const GAME_DURATION = 30;

const App: React.FC = () => {
  // UI state
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(GAME_DURATION);
  const [level, setLevel] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasQuit, setHasQuit] = useState(false);
  const [gameKey, setGameKey] = useState(0);  // to remount on reset

  // LEVEL UP every time score crosses level * 100
  useEffect(() => {
    if (score >= level * 100) {
      setLevel(l => l + 1);
    }
  }, [score, level]);

  // Refs for the game logic
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const timerRef     = useRef<number>(0);
  const ballX        = useRef(0);
  const ballY        = useRef(0);
  const ballVelX     = useRef(0);
  const ballVelY     = useRef(0);
  const isBoosted    = useRef(false);

  const leftAngle    = useRef(0);
  const rightAngle   = useRef(0);
  const rotateLeft   = useRef(false);
  const rotateRight  = useRef(false);
  const rotation     = useRef(0);

  const particles    = useRef<Particle[]>([]);
  const ripples      = useRef<Ripple[]>([]);
  const deformations = useRef<Deformation[]>([]);
  const ballScale    = useRef(1);
  const fogs         = useRef<Fog[]>([]);

  const resetGame = () => {
    setScore(0);
    setTimer(GAME_DURATION);
    setLevel(1);
    setIsGameOver(false);
    setHasQuit(false);
    setGameKey(k => k + 1);
  };

  if (hasQuit) {
    return (
      <div className="quit-screen">
        <h2>Thanks for playing!</h2>
      </div>
    );
  }

  return (
    <div key={gameKey} className="game-container">
      <div className="game-info">
        <div>Total Score: {score}</div>
        <div>Level: {level}</div>
        <div>Time Left: {timer}s</div>
      </div>

      <canvas ref={canvasRef} className="game-canvas" />

      <button
        className="flipper-btn"
        style={{ left: '10%' }}
        onMouseDown={() => (rotateLeft.current = true)}
        onMouseUp={()   => (rotateLeft.current = false)}
        onMouseLeave={()=> (rotateLeft.current = false)}
        onTouchStart={()=> (rotateLeft.current = true)}
        onTouchEnd={() => (rotateLeft.current = false)}
      >
        Left
      </button>

      <button
        className="flipper-btn"
        style={{ right: '10%' }}
        onMouseDown={() => (rotateRight.current = true)}
        onMouseUp={()   => (rotateRight.current = false)}
        onMouseLeave={()=> (rotateRight.current = false)}
        onTouchStart={()=> (rotateRight.current = true)}
        onTouchEnd={() => (rotateRight.current = false)}
      >
        Right
      </button>

      {isGameOver && (
        <div className="game-over">
          <div className="cloud cloud1" />
          <div className="cloud cloud2" />
          <div className="cloud cloud3" />

          <h2>Game Over</h2>
          <p>Your final score: {score}</p>

          <div className="sparkles">
            <div className="sparkle" />
            <div className="sparkle" />
            <div className="sparkle" />
          </div>

          <button className="play-btn" onClick={resetGame}>Play Again</button>
          <button className="quit-btn" onClick={() => setHasQuit(true)}>Quit</button>
        </div>
      )}

      <GameLogic
        canvasRef={canvasRef}
        timerRef={timerRef}
        ballX={ballX}
        ballY={ballY}
        ballVelX={ballVelX}
        ballVelY={ballVelY}
        isBoosted={isBoosted}
        leftAngle={leftAngle}
        rightAngle={rightAngle}
        rotateLeft={rotateLeft}
        rotateRight={rotateRight}
        rotation={rotation}
        particles={particles}
        ripples={ripples}
        deformations={deformations}
        ballScale={ballScale}
        fogs={fogs}
        scoreSetter={setScore}
        timerSetter={setTimer}
        setGameOver={setIsGameOver}
      />
    </div>
  );
};

export default App;
