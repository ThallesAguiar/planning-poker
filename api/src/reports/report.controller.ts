import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ReportService } from './report.service.js';

@Controller()
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  @Post('rooms/:id/report') generate(@Param('id') roomId: string) { return this.reports.generate(roomId); }

  @Get('rooms/:id/reports') list(@Param('id') roomId: string, @Req() request: Request) {
    return this.reports.listForRoom(roomId, this.token(request));
  }

  @Get('reports/:id') get(@Param('id') reportId: string, @Req() request: Request) {
    return this.reports.get(reportId, this.token(request));
  }

  @Get('reports/:id/export.csv') async csv(@Param('id') reportId: string, @Req() request: Request, @Res() response: Response) {
    response.type('text/csv').send(await this.reports.exportCsv(reportId, this.token(request)));
  }

  @Get('reports/:id/export.pdf') async pdf(@Param('id') reportId: string, @Req() request: Request, @Res() response: Response) {
    response.type('application/pdf').send(await this.reports.exportPdf(reportId, this.token(request)));
  }

  private token(request: Request) {
    const header = request.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : '';
  }
}
