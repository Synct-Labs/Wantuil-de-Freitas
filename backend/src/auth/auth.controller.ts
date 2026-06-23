import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { IsEmail, IsString, MinLength } from 'class-validator';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) senha: string;
}

class SolicitarResetDto {
  @IsEmail() email: string;
}

class DefinirSenhaDto {
  @IsString() token: string;
  @IsString() @MinLength(6) senha: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.senha);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@Req() req: any) {
    return this.auth.me(req.user.id);
  }

  // ─── Convite / Reset / Definicao de senha ─────────────────────────
  // Endpoints PUBLICOS (sem JWT) usados pela tela /definir-senha

  @Get('validar-token')
  validarToken(@Query('token') token: string) {
    return this.auth.validarToken(token);
  }

  @Post('definir-senha')
  definirSenha(@Body() dto: DefinirSenhaDto) {
    return this.auth.definirSenha(dto.token, dto.senha);
  }

  @Post('solicitar-reset')
  solicitarReset(@Body() dto: SolicitarResetDto) {
    return this.auth.solicitarResetSenha(dto.email);
  }
}
