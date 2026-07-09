import {
  ArgumentsHost, Catch, ExceptionFilter,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Captura QUALQUER erro nao tratado em qualquer rota e devolve uma
 * resposta JSON descritiva, em vez do generico "Internal server error".
 *
 * Tambem loga o erro completo no servidor (visivel nos logs do Render),
 * facilitando diagnostico em producao.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Excecoes HTTP do NestJS (BadRequest, NotFound, etc.) — usar a resposta delas
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      return response.status(status).json(typeof resp === 'string' ? { message: resp } : resp);
    }

    // Erros do Prisma — mapear para mensagens uteis
    const code = exception?.code;
    if (code === 'P2002') {
      return response.status(HttpStatus.CONFLICT).json({
        message: 'Ja existe um registro com este valor unico',
        campo: exception?.meta?.target,
      });
    }
    if (code === 'P2003') {
      return response.status(HttpStatus.BAD_REQUEST).json({
        message: 'Referencia invalida: registro relacionado nao existe',
      });
    }
    if (code === 'P2025') {
      return response.status(HttpStatus.NOT_FOUND).json({
        message: 'Registro nao encontrado',
      });
    }
    if (code?.startsWith?.('P')) {
      // Outros erros do Prisma
      this.logger.error(`Erro Prisma ${code} em ${request?.method} ${request?.url}: ${exception.message}`);
      return response.status(HttpStatus.BAD_REQUEST).json({
        message: `Erro de banco de dados (${code}): ${exception.message}`,
      });
    }

    // Erro completamente desconhecido — loga stack trace e devolve mensagem amigavel
    this.logger.error(
      `Erro nao tratado em ${request?.method} ${request?.url}: ${exception?.message || exception}`,
      exception?.stack,
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: exception?.message || 'Erro inesperado no servidor',
      // Em producao, nao expoe stack. Em dev sim.
      ...(process.env.NODE_ENV !== 'production' && { detalhes: exception?.stack }),
    });
  }
}
