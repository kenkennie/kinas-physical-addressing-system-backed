import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Point } from 'geojson';

@Entity('entry_points')
export class EntryPoint {
  @PrimaryGeneratedColumn()
  gid: number;

  @Column('decimal', { precision: 10, scale: 2 })
  x: number;

  @Column('decimal', { precision: 10, scale: 2 })
  y: number;

  @Column()
  label: number;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  geom: Point;

  // @Column({ nullable: true })
  // parcel_gid: number;

  // @Column({ type: 'varchar', length: 255, nullable: true })
  // access_type: string; // main, side, pedestrian
}
