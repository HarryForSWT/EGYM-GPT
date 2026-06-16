'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, X, Plus } from 'lucide-react'
import { t } from '@/lib/i18n'

type RestTimerProps = {
  duration: number // in seconds
  onClose: () => void
  lang: 'de' | 'en' | 'ru'
}

export default function RestTimer({ duration, onClose, lang }: RestTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(duration)
  const [isActive, setIsActive] = useState(true)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Audio context beep function
  const playBeep = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200])
      }
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtxClass) return
      const audioCtx = new AudioCtxClass()
      
      // Triple beep
      const beeps = [0, 0.4, 0.8]
      beeps.forEach((delay) => {
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        
        osc.type = 'sine'
        osc.frequency.value = 880 // A5 note
        
        const start = audioCtx.currentTime + delay
        const stop = start + 0.15
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime)
        gain.gain.setValueAtTime(0.3, start)
        gain.gain.exponentialRampToValueAtTime(0.01, stop)
        
        osc.start(start)
        osc.stop(stop)
      })
    } catch (e) {
      console.warn('AudioContext beep failed:', e)
    }
  }

  useEffect(() => {
    if (isActive && secondsRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            playBeep()
            setIsActive(false)
            if (timerRef.current) clearInterval(timerRef.current)
            return 0;
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isActive, secondsRemaining])

  const toggleActive = () => {
    setIsActive(!isActive)
  }

  const addTime = () => {
    setSecondsRemaining((prev) => prev + 30)
    setIsActive(true)
  }

  const progress = (secondsRemaining / duration) * 100
  const isFinished = secondsRemaining === 0

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className={`rest-timer-floating ${isFinished ? 'pulse-finished' : ''}`}>
      <div className="rest-timer-header">
        <span className="rest-timer-title">
          ⏱️ {t(lang, 'restTimer')}
        </span>
        <button className="rest-timer-close" onClick={onClose} aria-label="Close timer">
          <X size={16} />
        </button>
      </div>

      <div className="rest-timer-body">
        <div className="rest-timer-time">
          {isFinished ? '0:00' : formatTime(secondsRemaining)}
        </div>
        
        <div className="rest-timer-controls">
          {!isFinished && (
            <button className="rest-timer-btn" onClick={toggleActive} aria-label={isActive ? 'Pause' : 'Play'}>
              {isActive ? <Pause size={16} /> : <Play size={16} />}
            </button>
          )}
          <button className="rest-timer-btn text-accent" onClick={addTime} aria-label="Add 30 seconds">
            <Plus size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>+30s</span>
          </button>
        </div>
      </div>

      <div className="rest-timer-progress-bg">
        <div 
          className="rest-timer-progress-fill" 
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      <style jsx global>{`
        .rest-timer-floating {
          position: fixed;
          bottom: 80px; /* Above the bottom navigation */
          right: 16px;
          width: 280px;
          background: rgba(var(--bg-elevated-rgb, 30, 30, 30), 0.75);
          backdrop-filter: blur(12px) saturate(180%);
          -webkit-backdrop-filter: blur(12px) saturate(180%);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
          padding: 12px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-family: inherit;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: border-color 0.3s, box-shadow 0.3s;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .pulse-finished {
          border-color: var(--accent);
          box-shadow: 0 0 15px var(--accent-glow);
          animation: pulseBorder 1.5s infinite alternate;
        }

        @keyframes pulseBorder {
          from {
            box-shadow: 0 0 10px rgba(0, 212, 170, 0.2);
          }
          to {
            box-shadow: 0 0 20px rgba(0, 212, 170, 0.6);
          }
        }

        .rest-timer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .rest-timer-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .rest-timer-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
        }

        .rest-timer-close:hover {
          color: var(--text-primary);
        }

        .rest-timer-body {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
        }

        .rest-timer-time {
          font-size: 1.8rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--text-primary);
          line-height: 1;
        }

        .rest-timer-controls {
          display: flex;
          gap: 8px;
        }

        .rest-timer-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          cursor: pointer;
          gap: 4px;
          transition: background 0.15s, border-color 0.15s;
        }

        .rest-timer-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: var(--text-muted);
        }

        .rest-timer-progress-bg {
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          overflow: hidden;
        }

        .rest-timer-progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 2px;
          transition: width 1s linear;
        }
      `}</style>
    </div>
  )
}
