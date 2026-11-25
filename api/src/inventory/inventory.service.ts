import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma.service';
import { requireOwnedAttachments } from '../files/file-access';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    purchasedBy: { select: { id: true, name: true, email: true } },
    department: { select: { id: true, name: true } },
  };

  async create(dto: CreateInventoryItemDto, actorId: string) {
    const { value, purchaseDate, warrantyDate, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      await requireOwnedAttachments(tx, actorId, [dto.photoKey]);
      return tx.inventoryItem.create({
        data: {
          ...rest,
          purchasedById: actorId,
          value: new Decimal(value),
          ...(purchaseDate ? { purchaseDate: new Date(purchaseDate) } : {}),
          ...(warrantyDate ? { warrantyDate: new Date(warrantyDate) } : {}),
        },
        include: this.include,
      });
    });
  }

  findAll() {
    return this.prisma.inventoryItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: this.include,
    });
    if (!item) throw new NotFoundException('Item de inventário não encontrado');
    return item;
  }

  async update(id: string, dto: UpdateInventoryItemDto, actorId: string) {
    const { value, purchaseDate, warrantyDate, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (dto.photoKey !== undefined) {
        const previous = await tx.inventoryItem.findUnique({
          where: { id },
          select: { photoKey: true },
        });
        await requireOwnedAttachments(
          tx,
          actorId,
          [dto.photoKey],
          [previous?.photoKey],
        );
      }
      return tx.inventoryItem.update({
        where: { id },
        data: {
          ...rest,
          ...(value !== undefined ? { value: new Decimal(value) } : {}),
          ...(purchaseDate ? { purchaseDate: new Date(purchaseDate) } : {}),
          ...(warrantyDate ? { warrantyDate: new Date(warrantyDate) } : {}),
        },
        include: this.include,
      });
    });
  }

  async remove(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item de inventário não encontrado');
    return this.prisma.inventoryItem.delete({ where: { id } });
  }
}
