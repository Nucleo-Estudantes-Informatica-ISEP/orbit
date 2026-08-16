import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CreateRecruitmentCommentInput {
  candidateId: string;
  createdById: string;
  content: string;
}

@Injectable()
export class RecruitmentCommentService {
  constructor(private prisma: PrismaService) {}

  private readonly include = {
    createdBy: { select: { id: true, name: true } },
  };

  create(data: CreateRecruitmentCommentInput) {
    return this.prisma.recruitmentComment.create({
      data,
      include: this.include,
    });
  }

  findAllForCandidate(candidateId: string) {
    return this.prisma.recruitmentComment.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'asc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.recruitmentComment.findUnique({
      where: { id },
      include: this.include,
    });
    if (!c) throw new NotFoundException('Comment not found');
    return c;
  }

  remove(id: string) {
    return this.prisma.recruitmentComment.delete({ where: { id } });
  }
}
