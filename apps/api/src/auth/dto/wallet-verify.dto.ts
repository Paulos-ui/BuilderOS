import { IsString } from 'class-validator';

export class WalletVerifyDto {
  @IsString()
  message: string;

  @IsString()
  signature: string;
}
