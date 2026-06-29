import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma.service';
import { MinioService } from '../files/minio.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  private readonly include = {
    purchasedBy: { select: { id: true, name: true, email: true } },
    department: { select: { id: true, name: true } },
  };

  async create(dto: CreateInventoryItemDto) {
    const { performedById, value, purchaseDate, warrantyDate, ...rest } = dto;
    const item = await this.prisma.inventoryItem.create({
      data: {
        ...rest,
        value: new Decimal(value),
        ...(purchaseDate ? { purchaseDate: new Date(purchaseDate) } : {}),
        ...(warrantyDate ? { warrantyDate: new Date(warrantyDate) } : {}),
      },
      include: this.include,
    });
    if (performedById) {
      this.prisma.auditLog.create({
        data: { performedById, action: 'CREATE_INVENTORY_ITEM', entity: 'InventoryItem', entityId: item.id },
      }).catch(() => {});
    }
    return item;
  }

  findAll() {
    return this.prisma.inventoryItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id }, include: this.include });
    if (!item) throw new NotFoundException('Item de inventário não encontrado');
    return item;
  }

  async update(id: string, dto: UpdateInventoryItemDto) {
    const { performedById, value, purchaseDate, warrantyDate, ...rest } = dto;
    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...rest,
        ...(value !== undefined ? { value: new Decimal(value) } : {}),
        ...(purchaseDate ? { purchaseDate: new Date(purchaseDate) } : {}),
        ...(warrantyDate ? { warrantyDate: new Date(warrantyDate) } : {}),
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item de inventário não encontrado');
    if (item.photoKey) {
      await this.minio.deleteObject(item.photoKey).catch(() => {});
    }
    return this.prisma.inventoryItem.delete({ where: { id } });
  }
}
