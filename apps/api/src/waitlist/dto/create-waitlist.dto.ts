import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const BUILDER_ROLES = [
  'developer',
  'founder',
  'researcher',
  'designer',
  'creator',
  'other',
] as const;

export class CreateWaitlistDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(BUILDER_ROLES as unknown as string[])
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ecosystem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;
}
