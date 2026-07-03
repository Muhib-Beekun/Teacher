import { useRef, useEffect } from 'preact/hooks';
import { listening } from '../state';

interface WaveformProps {
    analyser: AnalyserNode | null;
}

export function Waveform({ analyser }: WaveformProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const sizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            ctx.scale(dpr, dpr);
        };
        sizeCanvas();

        const draw = () => {
            const buf = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(buf);
            const rect = canvas.getBoundingClientRect();
            const cw = rect.width;
            const ch = rect.height;
            ctx.clearRect(0, 0, cw, ch);
            const bars = 24;
            const step = Math.floor(buf.length / bars);
            const w = cw / bars;
            for (let i = 0; i < bars; i++) {
                const h = Math.max(3, (buf[i * step] / 255) * ch * 0.88);
                ctx.fillStyle = listening.peek() ? '#6b8aff' : '#3a4052';
                ctx.fillRect(i * w + 2, (ch - h) / 2, w - 4, h);
            }
            animRef.current = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [analyser]);

    return (
        <canvas
            ref={canvasRef}
            class="waveform"
            width={232}
            height={44}
            aria-hidden="true"
        />
    );
}
