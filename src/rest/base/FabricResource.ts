/**
 * Fabric resource base classes.
 *
 * Generic CRUD-with-addresses bases for fabric resources. They live here (not in
 * the fabric namespace) so the generated `fabric.resources.generated` subclasses can
 * extend them without an import cycle. Re-exported from the fabric namespace.
 */

import { CrudWithAddresses } from './CrudWithAddresses.js';

/** Standard fabric resource: CRUD plus address listing (PATCH updates). */
export class FabricResource<
  TList = unknown,
  TItem = unknown,
  TCreate = unknown,
  TUpdate = unknown,
> extends CrudWithAddresses<TList, TItem, TCreate, TUpdate> {}

/** Fabric resource that uses PUT for updates. */
export class FabricResourcePUT<
  TList = unknown,
  TItem = unknown,
  TCreate = unknown,
  TUpdate = unknown,
> extends CrudWithAddresses<TList, TItem, TCreate, TUpdate> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';
}
