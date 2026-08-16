import { IsEmail, Matches, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string;

  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code.' })
  code: string;
}
