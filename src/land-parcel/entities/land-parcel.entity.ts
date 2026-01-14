import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('land_parcel')
export class LandParcel {
  @PrimaryGeneratedColumn()
  gid: number;

  @Column()
  objectid: number;

  @Column({ type: 'varchar', length: 255 })
  entity: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  lr_no: string;

  @Column({ type: 'varchar', length: 100 })
  fr_no: string;

  @Column('decimal', { precision: 15, scale: 9 })
  area: number;

  @Column({ nullable: true })
  pas: string;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiPolygon',
    srid: 3857,
  })
  geom: any;

  // @Column({ type: 'varchar', length: 50, nullable: true })
  // physical_address: string; // Generated address code

  // @Column({ nullable: true })
  // admin_block_gid: number;
}
