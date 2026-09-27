import { Module } from '@nestjs/common';

import { ImagesService } from './images.service.js';

// Controllers (upload-url, submit, gallery, reports) are added by T16/T18.
@Module({
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
