import fs from 'fs';
import { privateKeyToAccount } from 'viem/accounts';

const envFile = fs.readFileSync('.env', 'utf-8');
const pkLine = envFile.split('\n').find(line => line.startsWith('AGENT_OWNER_PRIVATE_KEY='));
const pk = pkLine ? pkLine.split('=')[1].trim() : '';

console.log(privateKeyToAccount(pk as `0x${string}`).address);
