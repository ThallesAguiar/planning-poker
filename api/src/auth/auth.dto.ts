import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  claimGuestSessionToken?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export type SafeAuthUser = {
  id: string;
  email: string;
  name: string;
  avatar: string;
};

export type AuthResponse = {
  user: SafeAuthUser;
  token: string;
  expiresAt: string;
};
