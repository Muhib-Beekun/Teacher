import { vi } from 'vitest';

Object.defineProperty(window, 'SpeechRecognition', { value: undefined, writable: true });
Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, writable: true });
Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
});
