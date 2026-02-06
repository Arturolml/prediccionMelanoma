import { Injectable } from '@nestjs/common';
import { CreateLesioneDto } from './dto/create-lesione.dto';
import { UpdateLesioneDto } from './dto/update-lesione.dto';

@Injectable()
export class LesionesService {
  create(createLesioneDto: CreateLesioneDto) {
    return 'This action adds a new lesione';
  }

  findAll() {
    return `This action returns all lesiones`;
  }

  findOne(id: number) {
    return `This action returns a #${id} lesione`;
  }

  update(id: number, updateLesioneDto: UpdateLesioneDto) {
    return `This action updates a #${id} lesione`;
  }

  remove(id: number) {
    return `This action removes a #${id} lesione`;
  }
}
