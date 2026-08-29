import { describe, expect, it } from 'vitest';
import { PdfExportService } from './pdf-export.service.js';

describe('PdfExportService', () => {
  it('renders a readable PDF document from report facts', () => {
    const pdf = new PdfExportService().render({ stories: [{ title: 'Login', status: 'estimada', finalValue: 5, rounds: 2 }] });
    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect(pdf.toString()).toContain('Planning Poker');
    expect(pdf.toString()).toContain('xref');
  });
});
