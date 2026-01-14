import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('roads')
export class Road {
  @PrimaryGeneratedColumn()
  gid: number;

  @Column({ type: 'bigint' })
  osm_id: number;

  @Column()
  code: number;

  @Column({ type: 'varchar', length: 50 })
  fclass: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ref: string;

  @Column({ type: 'char', length: 1 })
  oneway: string;

  @Column()
  maxspeed: number;

  @Column()
  layer: number;

  @Column({ type: 'char', length: 1 })
  bridge: string;

  @Column({ type: 'char', length: 1 })
  tunnel: string;

  @Column('decimal', { precision: 15, scale: 9 })
  shape_leng: number;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiLineString',
    srid: 4326,
  })
  geom: any;
}
