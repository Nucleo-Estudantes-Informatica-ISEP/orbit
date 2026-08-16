import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Post()
  @Permissions('INVENTORY_CREATE')
  create(@Body() dto: CreateInventoryItemDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('INVENTORY_READ')
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('INVENTORY_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('INVENTORY_UPDATE')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Permissions('INVENTORY_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
