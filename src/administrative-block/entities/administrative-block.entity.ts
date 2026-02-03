import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('administrative_block')
export class AdministrativeBlock {
  @PrimaryGeneratedColumn()
  gid: number;

  @Column()
  const_code: number;

  @Column()
  objectid_2: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column()
  objectid: number;

  @Column({ type: 'varchar', length: 255 })
  constituen: string;

  @Column({ type: 'varchar', length: 255 })
  county_nam: string;

  @Column({ type: 'varchar', length: 20 })
  short_name: string;

  @Column('decimal', { precision: 15, scale: 3 })
  shape_area: number;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiPolygon',
    srid: 4326,
  })
  geom: any;
}
