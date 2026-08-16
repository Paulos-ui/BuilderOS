import { IsEmail, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string;
}
