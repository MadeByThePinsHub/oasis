import { getRefData } from '../utils/getRefData';
import { allEntities, EntityData } from './Entity';

type Constructor<T> = { new (): T };

export class BaseEntity {
  static _entity: EntityData;

  static deserialize(orig: any) {
    const formatter = this.entity.options?.deserialize;
    const data = formatter ? formatter(orig) : { ...orig };

    // The relations
    for (const { type, name, ...fieldData } of this._entity.fields) {
      const deserializeVal =
        'entity' in fieldData && fieldData.entity
          ? fieldData.entity.deserialize.bind(this)
          : (o: any) => o;

      if (type === 'deserializer' && 'deserialize' in fieldData) {
        const val = data[name];
        data[name] = {
          then: async (cb: any) => {
            return cb(fieldData.deserialize(val));
          },
        };
      }

      if (type === 'relation') {
        if ('multi' in fieldData && fieldData.multi) {
          const refs = data[name] as FirebaseFirestore.DocumentReference[];

          // data[name] = refs.map((ref) => ({
          //   then: (cb: any) => Promise.resolve(cb(getRefData(ref))),
          // }));

          data[name] = {
            then: async (cb: any) => {
              const all = await Promise.all(
                refs.map((ref) => deserializeVal(getRefData(ref)))
              );
              return cb(all);
            },
          };

          continue;
        }

        const ref = data[name] as FirebaseFirestore.DocumentReference;

        // Return a thenable that fetches the data
        data[name] = {
          then: async (cb: any) => {
            const refData = ref ? deserializeVal(await getRefData(ref)) : null;
            return cb(refData);
          },
        };
      }
    }

    return data;
  }

  static get entity() {
    return (
      this._entity ||
      (this._entity = allEntities.find((e) => e.name === this.name))
    );
  }

  static async findOne<T extends BaseEntity>(
    this: Constructor<T>,
    id: string
  ): Promise<T> {
    const entity: EntityData = (this as any).entity;
    console.log(id);
    const snap = entity.collection.doc(`${id}`);
    // return (this as any).deserialize(getRefData(snap) as any);
    return (await snap.get()).data() as T;
  }

  static async paginate<T extends BaseEntity>(
    this: Constructor<T>,
    offset: number,
    limit: number
  ): Promise<T[]> {
    const entity: EntityData = (this as any).entity;
    const all = await entity.collection.get();
    return all.docs.slice(offset, limit + offset).map((doc) => {
      const data = (this as any).deserialize(doc.data());

      const obj: any = {
        id: doc.id,
        ...data,
      };
      return obj as T;
    });
  }

  static async find<T extends BaseEntity>(this: Constructor<T>): Promise<T[]> {
    const entity: EntityData = (this as any).entity;
    const all = await entity.collection.get();
    return all.docs.map((doc) => {
      const data = (this as any).deserialize(doc.data());

      const obj: any = {
        id: doc.id,
        ...data,
      };
      return obj as T;
    });
  }

  /**
   * @description Filters by a field
   * @param fieldName The name of the firebase field
   * @param value Value of the field
   */
  static async query<T extends BaseEntity>(
    this: Constructor<T>,
    fieldName: string,
    value: string
  ): Promise<T[]> {
    const entity: EntityData = (this as any).entity;
    const collection = entity.collection;
    const snap = await collection.where(fieldName, '==', value).get();
    return snap.docs.map((doc) => (doc.data() as any) as T);
  }
}
