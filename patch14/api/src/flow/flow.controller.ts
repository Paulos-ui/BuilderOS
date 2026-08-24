import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { FlowService, type ChecklistItem, type Stage } from './flow.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/flow')
export class FlowController {
  constructor(private readonly flow: FlowService) {}

  @Get('applications')
  list(@CurrentUser() user: JwtPayload) {
    return this.flow.list(user.builderProfileId);
  }

  @Post('applications')
  create(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      title: string;
      sourceUrl?: string;
      deadline?: string;
      opportunityId?: string;
    },
  ) {
    return this.flow.create(user.builderProfileId, body);
  }

  @Patch('applications/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: {
      stage?: Stage;
      deadline?: string | null;
      notes?: string;
      checklist?: ChecklistItem[];
    },
  ) {
    return this.flow.update(user.builderProfileId, id, body);
  }

  @Delete('applications/:id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.flow.remove(user.builderProfileId, id);
  }
}
