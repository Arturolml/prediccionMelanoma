import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IaService } from './ia.service';

@Module({
  imports: [HttpModule],
  providers: [IaService],
  exports: [IaService],
})
export class IaModule { }
