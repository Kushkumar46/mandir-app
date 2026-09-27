import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../core/prisma/prisma.module.js';

/** Server-authoritative coin wallet: credit/debit in one DB transaction (T5). */
@Injectable()
export class CoinsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current balance; users without a wallet row have 0. */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.coinWallet.findUnique({ where: { userId }, select: { balance: true } });
    return wallet?.balance ?? 0;
  }
}
