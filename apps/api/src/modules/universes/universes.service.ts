import { Injectable, NotFoundException } from '@nestjs/common';
import { getUniverse, listUniverses } from '@ai-trading/database';

@Injectable()
export class UniversesService {
  list() {
    return listUniverses();
  }

  async detail(id: string) {
    const universe = await getUniverse(id);
    if (!universe) throw new NotFoundException('Universe not found');
    return universe;
  }

  async versions(id: string) {
    const universe = await this.detail(id);
    return universe.versions;
  }
}
