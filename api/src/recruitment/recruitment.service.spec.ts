import type { PrismaService } from '../prisma.service';
import type { MinioService } from '../files/minio.service';
import { RecruitmentService } from './recruitment.service';

it('exports individual and bulk candidate PDFs with standard fonts and links', async () => {
  const candidate = {
    name: 'Test Candidate',
    email: 'candidate@example.com',
    course: 'Informatics',
    year: 2,
    stage: 'RECEIVED',
    createdAt: new Date('2026-01-01'),
    notes: 'Test notes',
    cvUrl: 'https://example.com/cv.pdf',
    departmentChoices: [{ priority: 1, department: { name: 'Engineering' } }],
    comments: [
      {
        content: 'Test comment',
        createdAt: new Date('2026-01-02'),
        createdBy: { name: 'Reviewer' },
      },
    ],
  };
  const prisma = {
    candidate: {
      findUnique: jest.fn().mockResolvedValue(candidate),
      findMany: jest.fn().mockResolvedValue([candidate, candidate]),
    },
  };
  const service = new RecruitmentService(
    prisma as unknown as PrismaService,
    {} as MinioService,
  );

  for (const pdf of await Promise.all([
    service.exportOne('candidate-id'),
    service.exportAll(),
  ])) {
    expect(Buffer.isBuffer(pdf)).toBe(true);
    const content = pdf.toString('latin1');
    expect(content).toMatch(/^%PDF-/);
    expect(content).toContain('/BaseFont /Helvetica-Bold');
    expect(content).toContain('https://example.com/cv.pdf');
    expect(content.trimEnd()).toMatch(/%%EOF$/);
  }
});
