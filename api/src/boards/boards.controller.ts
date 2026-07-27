import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateBoardDto, IdParamDto, UpdateBoardDto } from '../contracts/request.dto';
import { BoardResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';

@ApiTags('boards')
@ApiProtectedController()
@Controller('boards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BoardsController {
  constructor(private svc: BoardsService) {}

  @Post()
  @Permissions('BOARDS_CREATE')
  @ApiCreatedResponse({ type: BoardResponseDto })
  create(@Body() body: CreateBoardDto) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('BOARDS_READ')
  @ApiOkResponse({ type: BoardResponseDto, isArray: true })
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('BOARDS_READ')
  @ApiOkResponse({ type: BoardResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('BOARDS_UPDATE')
  @ApiOkResponse({ type: BoardResponseDto })
  update(@Param() params: IdParamDto, @Body() body: UpdateBoardDto) {
    return this.svc.update(params.id, body);
  }

  @Delete(':id')
  @Permissions('BOARDS_DELETE')
  @ApiOkResponse({ type: BoardResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
