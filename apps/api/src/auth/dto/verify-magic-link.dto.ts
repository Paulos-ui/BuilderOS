import { IsString } from 'class-validator';

export class VerifyMagicLinkDto {
  @IsString()
  token: string;
}
