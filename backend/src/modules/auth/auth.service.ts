import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: dto.name,
      },
    });

    return this.generateTokens(user.id, user.email, user.role, user.name);
  }

  async login(dto: LoginDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const localUser = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (localUser && localUser.passwordHash) {
      const passwordValid = await this.verifyPassword(
        dto.password,
        localUser.passwordHash,
      );
      if (passwordValid) {
        return this.generateTokens(
          localUser.id,
          localUser.email,
          localUser.role,
          localUser.name,
        );
      }
    }

    const legacyUser = await this.findLegacyUser(normalizedEmail);

    if (!legacyUser?.encrypted_password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const legacyPasswordValid = await this.verifyPassword(
      dto.password,
      legacyUser.encrypted_password,
    );
    if (!legacyPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const email = (legacyUser.email || normalizedEmail).toLowerCase();
    const rawMeta = legacyUser.raw_user_meta_data as
      | Record<string, unknown>
      | null;
    const fallbackName = email.includes('@') ? email.split('@')[0] : 'User';
    const name =
      typeof rawMeta?.name === 'string'
        ? rawMeta.name
        : typeof rawMeta?.full_name === 'string'
          ? rawMeta.full_name
          : localUser?.name || fallbackName;

    const user =
      localUser ||
      (await this.prisma.user.create({
        data: {
          email,
          name,
          passwordHash: legacyUser.encrypted_password,
          role: 'MANAGER',
        },
      }));

    if (!user.passwordHash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: legacyUser.encrypted_password },
      });
    }

    return this.generateTokens(user.id, user.email, user.role, user.name);
  }

  async refreshTokens(refreshToken: string) {
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new UnauthorizedException('JWT refresh secret is not configured');
    }
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) throw new UnauthorizedException('User not found');

      return this.generateTokens(user.id, user.email, user.role, user.name);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  private generateTokens(
    userId: string,
    email: string,
    role: string,
    name?: string | null,
  ) {
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!jwtSecret || !refreshSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const payload = { sub: userId, email, role };

    const accessToken = this.jwt.sign(payload, {
      secret: jwtSecret,
      expiresIn: this.config.get('JWT_EXPIRATION', '15m'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: refreshSecret,
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, role, name: name || null },
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async verifyPassword(password: string, hash: string) {
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  private async findLegacyUser(email: string) {
    try {
      return await this.prisma.users.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          email: true,
          encrypted_password: true,
          raw_user_meta_data: true,
        },
      });
    } catch {
      return null;
    }
  }
}
