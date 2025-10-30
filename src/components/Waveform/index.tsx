import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
import styled from 'styled-components'

interface WaveformProps {
  peaks: number[]
  progress: number
  waveColor: string
  progressColor: string
  barWidth: number
  barGap: number
  barRadius: number
  height: number
  onSeek?: (seekProgress: number) => void
}

const Waveform: React.FC<WaveformProps> = ({
  peaks,
  progress,
  waveColor,
  progressColor,
  barWidth,
  barGap,
  barRadius,
  height,
  onSeek
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState<number>(0)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const isSeekingRef = useRef(false)

  // Measure width before painting
  useLayoutEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.clientWidth)
    }

    const handleResize = () => {
      if (containerRef.current) setWidth(containerRef.current.clientWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const barsCount = useMemo(() => {
    if (!width) return 0
    if (barWidth <= 0) return 0
    return Math.max(0, Math.floor((width + barGap) / (barWidth + barGap)))
  }, [width, barWidth, barGap])

  const barsData = useMemo(() => {
    if (barsCount === 0) return []
    const src = peaks && peaks.length ? peaks : []
    if (src.length === 0) return new Array(barsCount).fill(0)

    const normalized = src.map((v) => Math.min(1, Math.max(0, isFinite(v) ? v : 0)))

    if (normalized.length === barsCount) return normalized

    if (normalized.length > barsCount) {
      const step = normalized.length / barsCount
      const out: number[] = new Array(barsCount)
      for (let i = 0; i < barsCount; i++) {
        const start = Math.floor(i * step)
        const end = Math.floor((i + 1) * step)
        let sum = 0
        let cnt = 0
        for (let j = start; j < Math.max(end, start + 1) && j < normalized.length; j++) {
          sum += normalized[j]
          cnt++
        }
        out[i] = cnt ? sum / cnt : 0
      }
      return out
    } else {
      const out: number[] = new Array(barsCount)
      for (let i = 0; i < barsCount; i++) {
        const idx = Math.floor((i * normalized.length) / barsCount)
        out[i] = normalized[Math.min(idx, normalized.length - 1)]
      }
      return out
    }
  }, [peaks, barsCount])

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas || !width || !height) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const centerY = height / 2
    const totalBars = barsData.length
    const fullBarSpan = barWidth + barGap
    const clipX = Math.max(0, Math.min(width, progress * width))

    const drawBars = (color: string) => {
      ctx.fillStyle = color
      for (let i = 0; i < totalBars; i++) {
        const x = i * fullBarSpan
        if (x > width) break
        const amp = barsData[i] || 0
        const barH = Math.max(1, amp * height)
        const y = centerY - barH / 2
        fillRoundRect(ctx, x, y, barWidth, barH, barRadius)
      }
    }

    drawBars(waveColor)

    if (clipX > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, clipX, height)
      ctx.clip()
      drawBars(progressColor)
      ctx.restore()
    }

    ctx.restore()
  }

  useEffect(() => {
    if (width > 0) draw()
  }, [barsData, progress, waveColor, progressColor, barWidth, barGap, barRadius, height, width])

  const seekFromClientX = (clientX: number) => {
    if (!onSeek || !containerRef.current || !width) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const p = Math.max(0, Math.min(1, x / width))
    onSeek(p)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    isSeekingRef.current = true
    seekFromClientX(e.clientX)
    window.addEventListener('mousemove', onMouseMoveWindow)
    window.addEventListener('mouseup', onMouseUpWindow)
  }

  const onMouseMoveWindow = (e: MouseEvent) => {
    if (!isSeekingRef.current) return
    seekFromClientX(e.clientX)
  }

  const onMouseUpWindow = () => {
    isSeekingRef.current = false
    window.removeEventListener('mousemove', onMouseMoveWindow)
    window.removeEventListener('mouseup', onMouseUpWindow)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    isSeekingRef.current = true
    if (e.touches && e.touches[0]) seekFromClientX(e.touches[0].clientX)
    window.addEventListener('touchmove', onTouchMoveWindow, { passive: true })
    window.addEventListener('touchend', onTouchEndWindow)
    window.addEventListener('touchcancel', onTouchEndWindow)
  }

  const onTouchMoveWindow = (e: TouchEvent) => {
    if (!isSeekingRef.current || !e.touches || !e.touches[0]) return
    seekFromClientX(e.touches[0].clientX)
  }

  const onTouchEndWindow = () => {
    isSeekingRef.current = false
    window.removeEventListener('touchmove', onTouchMoveWindow)
    window.removeEventListener('touchend', onTouchEndWindow)
    window.removeEventListener('touchcancel', onTouchEndWindow)
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onMouseMoveWindow)
      window.removeEventListener('mouseup', onMouseUpWindow)
      window.removeEventListener('touchmove', onTouchMoveWindow)
      window.removeEventListener('touchend', onTouchEndWindow)
      window.removeEventListener('touchcancel', onTouchEndWindow)
    }
  }, [])

  return (
    <Container
      ref={containerRef}
      style={{ height }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      role='progressbar'
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0}
    >
      {width > 0 && <Canvas ref={canvasRef} />}
    </Container>
  )
}

export default Waveform

const Container = styled.div`
  width: 100%;
  display: block;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
`

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
`

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  if (radius === 0) {
    ctx.fillRect(x, y, w, h)
    return
  }
  const r2 = radius
  const x2 = x + w
  const y2 = y + h
  ctx.beginPath()
  ctx.moveTo(x + r2, y)
  ctx.lineTo(x2 - r2, y)
  ctx.arcTo(x2, y, x2, y + r2, r2)
  ctx.lineTo(x2, y2 - r2)
  ctx.arcTo(x2, y2, x2 - r2, y2, r2)
  ctx.lineTo(x + r2, y2)
  ctx.arcTo(x, y2, x, y2 - r2, r2)
  ctx.lineTo(x, y + r2)
  ctx.arcTo(x, y, x + r2, y, r2)
  ctx.closePath()
  ctx.fill()
}
