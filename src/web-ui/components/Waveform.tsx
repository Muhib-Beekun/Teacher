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

        const SIZE = 84;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(SIZE * dpr);
        canvas.height = Math.round(SIZE * dpr);
        ctx.scale(dpr, dpr);

        const cx = SIZE / 2;
        const cy = SIZE / 2;
        const radius = 36;
        const segments = 16;

        const draw = () => {
            const buf = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(buf);
            ctx.clearRect(0, 0, SIZE, SIZE);

            const step = Math.max(1, Math.floor(buf.length / segments));
            const active = listening.peek();
            const arcLen = (2 * Math.PI) / segments;
            const gap = 0.04;

            for (let i = 0; i < segments; i++) {
                const level = buf[i * step] / 255;
                const startAngle = i * arcLen - Math.PI / 2 + gap;
                const endAngle = startAngle + arcLen - gap * 2;
                const width = 2 + level * 4;

                ctx.beginPath();
                ctx.arc(cx, cy, radius, startAngle, endAngle);
                ctx.strokeStyle = active ? `rgba(107, 138, 255, ${0.3 + level * 0.7})` : '#3a4052';
                ctx.lineWidth = width;
                ctx.lineCap = 'round';
                ctx.stroke();
            }

            animRef.current = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [analyser]);

    if (!analyser) return null;

    return (
        <canvas
            ref={canvasRef}
            class="waveform-ring"
            width={84}
            height={84}
            aria-hidden="true"
        />
    );
}
