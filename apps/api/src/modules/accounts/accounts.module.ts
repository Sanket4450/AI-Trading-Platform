import { Module } from '@nestjs/common';
import { CredentialEncryptionService } from '../../common/security/credential-encryption.service.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, CredentialEncryptionService],
  exports: [CredentialEncryptionService],
})
export class AccountsModule {}
