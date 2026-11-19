import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  attachmentKey,
  requireOwnedAttachments,
  safeStoredAttachment,
} from '../files/file-access';
import PDFDocument from 'pdfkit';
import type { Prisma, RecruitmentStage } from '@prisma/client';

interface DepartmentChoiceInput {
  departmentId: string;
  priority: number;
}

interface CandidateFields {
  name: string;
  email: string;
  course?: string | null;
  year?: number | null;
  cvUrl?: string | null;
  notes?: string | null;
  stage?: RecruitmentStage;
}

export type CreateCandidateInput = CandidateFields & {
  departmentChoices?: DepartmentChoiceInput[];
};

export type UpdateCandidateInput = Partial<CandidateFields> & {
  departmentChoices?: DepartmentChoiceInput[];
};

type CandidateWithRelations = Prisma.CandidateGetPayload<{
  include: {
    departmentChoices: { include: { department: true } };
    comments: { include: { createdBy: { select: { name: true } } } };
  };
}>;

function safeCandidate<T extends { cvUrl: string | null }>(row: T): T {
  return { ...row, cvUrl: safeStoredAttachment(row.cvUrl) ?? null };
}

@Injectable()
export class RecruitmentService {
  constructor(private readonly prisma: PrismaService) {}

  private include = {
    departmentChoices: {
      include: { department: true },
      orderBy: { priority: 'asc' as const },
    },
    comments: {
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'asc' as const },
    },
  };

  create(data: CreateCandidateInput, actorId: string) {
    const { departmentChoices, ...createData } = data;
    const key = attachmentKey(data.cvUrl);
    return this.prisma.$transaction(async (tx) => {
      await requireOwnedAttachments(tx, actorId, [key]);
      return safeCandidate(
        await tx.candidate.create({
          data: {
            ...createData,
            cvUrl: key ?? data.cvUrl,
            departmentChoices: departmentChoices?.length
              ? {
                  create: departmentChoices.map(
                    (dc: { departmentId: string; priority: number }) => ({
                      departmentId: dc.departmentId,
                      priority: dc.priority,
                    }),
                  ),
                }
              : undefined,
          },
          include: this.include,
        }),
      );
    });
  }

  async findAll() {
    return (
      await this.prisma.candidate.findMany({ include: this.include })
    ).map(safeCandidate);
  }

  async findOne(id: string) {
    const c = await this.prisma.candidate.findUnique({
      where: { id },
      include: this.include,
    });
    if (!c) throw new NotFoundException('Candidate not found');
    return safeCandidate(c);
  }

  async update(id: string, data: UpdateCandidateInput, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { departmentChoices, ...updateData } = data;
      const key = attachmentKey(data.cvUrl);
      if (data.cvUrl !== undefined) {
        const previous = await tx.candidate.findUnique({
          where: { id },
          select: { cvUrl: true },
        });
        await requireOwnedAttachments(
          tx,
          actorId,
          [key],
          [attachmentKey(previous?.cvUrl)],
        );
      }
      if (departmentChoices) {
        await tx.candidateDepartmentChoice.deleteMany({
          where: { candidateId: id },
        });
        if (departmentChoices.length) {
          await tx.candidateDepartmentChoice.createMany({
            data: departmentChoices.map(
              (dc: { departmentId: string; priority: number }) => ({
                candidateId: id,
                departmentId: dc.departmentId,
                priority: dc.priority,
              }),
            ),
          });
        }
      }
      return safeCandidate(
        await tx.candidate.update({
          where: { id },
          data: { ...updateData, cvUrl: key ?? data.cvUrl },
          include: this.include,
        }),
      );
    });
  }

  async remove(id: string) {
    const c = await this.prisma.candidate.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Candidate not found');
    return safeCandidate(await this.prisma.candidate.delete({ where: { id } }));
  }

  async clearAll() {
    const { count } = await this.prisma.candidate.deleteMany();
    return { deleted: count };
  }

  async exportOne(id: string): Promise<Buffer> {
    const c = await this.prisma.candidate.findUnique({
      where: { id },
      include: this.include,
    });
    if (!c) throw new NotFoundException('Candidate not found');
    return this.generatePdf(safeCandidate(c));
  }

  async exportAll(): Promise<Buffer> {
    const candidates = await this.prisma.candidate.findMany({
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
    return this.generatePdf(candidates.map(safeCandidate));
  }

  private stageLabel(stage: string): string {
    const labels: Record<string, string> = {
      RECEIVED: 'Recebido',
      SCREENING: 'Triagem',
      INTERVIEW: 'Entrevista',
      OFFER: 'Oferta',
      HIRED: 'Contratado',
      REJECTED: 'Rejeitado',
    };
    return labels[stage] ?? stage;
  }

  private generatePdf(
    data: CandidateWithRelations | CandidateWithRelations[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-PT');
      const timeStr = now.toLocaleTimeString('pt-PT');

      const items = Array.isArray(data) ? data : [data];

      items.forEach((c, idx) => {
        if (idx > 0) doc.addPage();

        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text('ORBIT - NEI-ISEP', { align: 'center' });
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#666')
          .text('Sistema de Gestão de Recrutamento', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
        doc.moveDown(1);

        doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text(c.name);
        doc.moveDown(0.5);

        const leftX = 50;
        const rightX = 300;
        let y = doc.y;

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#333');
        doc.text('Email:', leftX, y);
        doc.font('Helvetica').fillColor('#000');
        doc.text(c.email, rightX, y);
        y += 18;

        if (c.course) {
          doc.font('Helvetica-Bold').fillColor('#333');
          doc.text('Curso:', leftX, y);
          doc.font('Helvetica').fillColor('#000');
          doc.text(c.course, rightX, y);
          y += 18;
        }

        if (c.year) {
          doc.font('Helvetica-Bold').fillColor('#333');
          doc.text('Ano:', leftX, y);
          doc.font('Helvetica').fillColor('#000');
          doc.text(`${c.year}º`, rightX, y);
          y += 18;
        }

        doc.font('Helvetica-Bold').fillColor('#333');
        doc.text('Estado:', leftX, y);
        doc.font('Helvetica').fillColor('#000');
        doc.text(this.stageLabel(c.stage), rightX, y);
        y += 18;

        doc.font('Helvetica-Bold').fillColor('#333');
        doc.text('Data de Criação:', leftX, y);
        doc.font('Helvetica').fillColor('#000');
        doc.text(new Date(c.createdAt).toLocaleDateString('pt-PT'), rightX, y);

        if (c.notes) {
          doc.moveDown(0.5);
          doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#000')
            .text('Notas:');
          doc.fontSize(10).font('Helvetica').fillColor('#333');
          doc.text(c.notes, { indent: 10 });
          doc.moveDown(0.5);
        }

        if (c.departmentChoices && c.departmentChoices.length > 0) {
          doc.moveDown(0.5);
          doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#000')
            .text('Preferências de Departamento:');
          doc.moveDown(0.3);
          for (const dc of c.departmentChoices) {
            doc.fontSize(10).font('Helvetica').fillColor('#333');
            doc.text(`${dc.priority}º ${dc.department.name}`, { indent: 20 });
          }
        }

        if (c.cvUrl) {
          doc.moveDown(0.5);
          doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#000')
            .text('Curriculum Vitae:');
          doc.fontSize(10).font('Helvetica').fillColor('#2563eb');
          doc.text(c.cvUrl, {
            indent: 10,
            link: /^https?:\/\//i.test(c.cvUrl) ? c.cvUrl : undefined,
            underline: true,
          });
        }

        if (c.comments && c.comments.length > 0) {
          doc.moveDown(1);
          doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#000')
            .text('Comentários:');
          doc.moveDown(0.3);
          for (const comment of c.comments) {
            doc
              .moveTo(60, doc.y)
              .lineTo(545, doc.y)
              .strokeColor('#eee')
              .stroke();
            doc.moveDown(0.3);
            const author = comment.createdBy?.name ?? 'Sistema';
            const date = new Date(comment.createdAt).toLocaleDateString(
              'pt-PT',
            );
            doc
              .fontSize(9)
              .font('Helvetica-Bold')
              .fillColor('#555')
              .text(`${author} - ${date}`, { indent: 10 });
            doc.fontSize(10).font('Helvetica').fillColor('#333');
            doc.text(comment.content, { indent: 10 });
            doc.moveDown(0.3);
          }
        }
      });

      // Footer on every page
      const pageCount = doc.bufferedPageRange?.()?.count ?? 1;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).font('Helvetica').fillColor('#999');
        doc.text(
          `Documento gerado em ${dateStr} às ${timeStr} pelo sistema ORBIT - NEI-ISEP`,
          50,
          doc.page.height - 40,
          { align: 'center' },
        );
        doc.text(`Página ${i + 1} de ${pageCount}`, 50, doc.page.height - 28, {
          align: 'center',
        });
      }

      doc.end();
    });
  }
}
