import { IsEthereumAddress } from 'class-validator';

export class WalletChallengeDto {
  @IsEthereumAddress()
  address: string;
}
