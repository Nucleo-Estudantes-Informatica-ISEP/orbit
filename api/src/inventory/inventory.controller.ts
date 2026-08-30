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
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IdParamDto } from '../contracts/request.dto';
import { InventoryItemResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('inventory')
@ApiProtectedController()
@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Post()
  @Permissions('INVENTORY_CREATE')
  @ApiCreatedResponse({ type: InventoryItemResponseDto })
  create(
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.svc.create(dto, actorId);
  }

  @Get()
  @Permissions('INVENTORY_READ')
  @ApiOkResponse({ type: InventoryItemResponseDto, isArray: true })
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('INVENTORY_READ')
  @ApiOkResponse({ type: InventoryItemResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('INVENTORY_UPDATE')
  @ApiOkResponse({ type: InventoryItemResponseDto })
  update(@Param() params: IdParamDto, @Body() dto: UpdateInventoryItemDto) {
    return this.svc.update(params.id, dto);
  }

  @Delete(':id')
  @Permissions('INVENTORY_DELETE')
  @ApiOkResponse({ type: InventoryItemResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
