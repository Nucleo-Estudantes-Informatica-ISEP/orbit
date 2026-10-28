import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { IdParamDto } from '../contracts/request.dto';
import { LifecycleService } from './lifecycle.service';
import {
  AccessConfigurationResponseDto,
  AccessResourceResponseDto,
  AccessPolicyResponseDto,
  IntakeResponseDto,
  AccessPreviewResponseDto,
  AccessPolicyDto,
  AccessPreviewDto,
  AccessResourceDto,
  CreateLifecycleDto,
  LifecycleDecisionDto,
  LifecycleQueryDto,
  LifecycleResponseDto,
  OperationEvidenceDto,
  OperationParamsDto,
  UpdateAccessPolicyDto,
  UpdateAccessResourceDto,
} from './lifecycle.dto';

@ApiTags('access-lifecycle')
@ApiProtectedController()
@UseGuards(JwtAuthGuard)
@Controller('access-lifecycle')
export class LifecycleController {
  constructor(private readonly service: LifecycleService) {}

  @Get('configuration')
  @ApiOkResponse({ type: AccessConfigurationResponseDto })
  configuration(@CurrentUser('userId') actor: string) {
    return this.service.configuration(actor);
  }

  @Get('intake')
  @ApiOkResponse({ type: IntakeResponseDto, isArray: true })
  intake(
    @CurrentUser('userId') actor: string,
    @Query() query: LifecycleQueryDto,
  ) {
    return this.service.intakeResponses(actor, query);
  }

  @Post('preview')
  @ApiCreatedResponse({ type: AccessPreviewResponseDto })
  preview(@CurrentUser('userId') actor: string, @Body() dto: AccessPreviewDto) {
    return this.service.preview(actor, dto);
  }

  @Post('resources')
  @ApiCreatedResponse({ type: AccessResourceResponseDto })
  resource(
    @CurrentUser('userId') actor: string,
    @Body() dto: AccessResourceDto,
  ) {
    return this.service.saveResource(actor, dto);
  }

  @Put('resources/:id')
  @ApiOkResponse({ type: AccessResourceResponseDto })
  updateResource(
    @CurrentUser('userId') actor: string,
    @Param() params: IdParamDto,
    @Body() dto: UpdateAccessResourceDto,
  ) {
    return this.service.saveResource(actor, dto, params.id);
  }

  @Post('policies')
  @ApiCreatedResponse({ type: AccessPolicyResponseDto })
  policy(@CurrentUser('userId') actor: string, @Body() dto: AccessPolicyDto) {
    return this.service.savePolicy(actor, dto);
  }

  @Put('policies/:id')
  @ApiOkResponse({ type: AccessPolicyResponseDto })
  updatePolicy(
    @CurrentUser('userId') actor: string,
    @Param() params: IdParamDto,
    @Body() dto: UpdateAccessPolicyDto,
  ) {
    return this.service.savePolicy(actor, dto, params.id);
  }

  @Post('processes')
  @ApiCreatedResponse({ type: LifecycleResponseDto })
  create(
    @CurrentUser('userId') actor: string,
    @Body() dto: CreateLifecycleDto,
  ) {
    return this.service.create(actor, dto);
  }

  @Get('processes')
  @ApiOkResponse({ type: LifecycleResponseDto, isArray: true })
  list(
    @CurrentUser('userId') actor: string,
    @Query() query: LifecycleQueryDto,
  ) {
    return this.service.list(actor, query);
  }

  @Get('processes/:id')
  @ApiOkResponse({ type: LifecycleResponseDto })
  get(@CurrentUser('userId') actor: string, @Param() params: IdParamDto) {
    return this.service.get(actor, params.id);
  }

  @Get('processes/:id/inventory')
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
  })
  inventory(@CurrentUser('userId') actor: string, @Param() params: IdParamDto) {
    return this.service.inventory(actor, params.id);
  }

  @Post('processes/:id/submit')
  @ApiCreatedResponse({ type: LifecycleResponseDto })
  submit(@CurrentUser('userId') actor: string, @Param() params: IdParamDto) {
    return this.service.submit(actor, params.id);
  }

  @Post('processes/:id/decision')
  @ApiCreatedResponse({ type: LifecycleResponseDto })
  decide(
    @CurrentUser('userId') actor: string,
    @Param() params: IdParamDto,
    @Body() dto: LifecycleDecisionDto,
  ) {
    return this.service.decide(actor, params.id, dto);
  }

  @Post('processes/:id/cancel')
  @ApiCreatedResponse({ type: LifecycleResponseDto })
  cancel(@CurrentUser('userId') actor: string, @Param() params: IdParamDto) {
    return this.service.cancel(actor, params.id);
  }

  @Post('processes/:id/operations/:operationId/confirm-manual')
  @ApiCreatedResponse({ type: LifecycleResponseDto })
  confirm(
    @CurrentUser('userId') actor: string,
    @Param() params: OperationParamsDto,
    @Body() dto: OperationEvidenceDto,
  ) {
    return this.service.confirm(actor, params.id, params.operationId, dto);
  }

  @Post('processes/:id/operations/:operationId/retry')
  @ApiCreatedResponse({ type: LifecycleResponseDto })
  retry(
    @CurrentUser('userId') actor: string,
    @Param() params: OperationParamsDto,
  ) {
    return this.service.retry(actor, params.id, params.operationId);
  }

  @Post('processes/:id/operations/:operationId/reconcile')
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: { status: { type: 'string' }, detail: { type: 'string' } },
    },
  })
  reconcile(
    @CurrentUser('userId') actor: string,
    @Param() params: OperationParamsDto,
  ) {
    return this.service.reconcile(actor, params.id, params.operationId);
  }
}
