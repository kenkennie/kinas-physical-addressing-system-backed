import { AdministrativeBlock } from 'src/administrative-block/entities/administrative-block.entity';
import { EntryPoint } from 'src/entry-points/entities/entry-point.entity';
import { LandParcel } from 'src/land-parcel/entities/land-parcel.entity';

export class AddressGenerator {
  static generatePhysicalAddress(
    parcel: LandParcel,
    adminBlock: AdministrativeBlock | null,
    entryPoint?: EntryPoint,
  ): string {
    const components: string[] = [];

    if (entryPoint) {
      components.push(`EP-${entryPoint.label}`);
    }

    components.push(parcel.lr_no);

    if (adminBlock) {
      components.push(adminBlock.name);
      components.push(adminBlock.constituen);
      components.push(adminBlock.county_nam);
    }

    return components.filter(Boolean).join(', ');
  }

  static generateShortCode(parcel: LandParcel): string {
    const lrParts = parcel.lr_no.replace(/[^a-zA-Z0-9]/g, '');
    const hash = this.hashCode(lrParts);
    return `KE-${hash.toString(36).toUpperCase().slice(0, 8)}`;
  }

  private static hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
