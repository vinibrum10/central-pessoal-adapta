import { afterEach, describe, expect, it, vi } from 'vitest';
import { speakEnglish } from './textToSpeech';

describe('speakEnglish', () => {
  const originalSpeechSynthesis = (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  const originalUtterance = (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;

  afterEach(() => {
    (window as unknown as { speechSynthesis?: unknown }).speechSynthesis = originalSpeechSynthesis;
    (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = originalUtterance;
    vi.restoreAllMocks();
  });

  it('não faz nada quando o navegador não suporta speechSynthesis', () => {
    // Arrange
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;

    // Act / Assert — não deve lançar
    expect(() => speakEnglish('transformer')).not.toThrow();
  });

  it('cancela qualquer fala em andamento e fala o texto em inglês (en-US)', () => {
    // Arrange
    const cancel = vi.fn();
    const speak = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { cancel, speak };

    class FakeUtterance {
      text: string;
      lang = '';
      constructor(text: string) {
        this.text = text;
      }
    }
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;

    // Act
    speakEnglish('lockout tagout');

    // Assert
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.text).toBe('lockout tagout');
    expect(utterance.lang).toBe('en-US');
  });
});
