/**
 * The shape of `api-index.json`, which `npm run build` writes from the
 * package's declarations (scripts/generate-tsdocs-api.ts) and
 * `sw-tsdocs api` reads.
 */

/** What an exported name is. */
export type ApiKind =
  'class' | 'interface' | 'type' | 'function' | 'variable' | 'enum' | 'namespace';

/** What a class or interface member is. */
export type ApiMemberKind = 'constructor' | 'method' | 'property' | 'accessor';

/** A member a class or interface declares itself (inherited ones live on the base's entry). */
export interface ApiMember {
  /** The member's name; `constructor` for a constructor. */
  name: string;
  /** Whether it's a method, property, accessor or constructor. */
  kind: ApiMemberKind;
  /** The key of the entry that declares it. */
  owner: string;
  /** True for a static member. */
  static?: boolean;
  /** True for a protected member, which subclasses use or override. */
  protected?: boolean;
  /** True for a readonly property. */
  readonly?: boolean;
  /** Its declarations as an editor shows them, one per overload. */
  signature: string[];
  /** Its JSDoc, without comment markers. */
  doc: string;
  /** Where it's declared, relative to the package root. */
  file: string;
  /** The 1-based line of the declaration. */
  line: number;
}

/** One name, exported from the package or a base class of one that is. */
export interface ApiEntry {
  /** The key: the exported name, or `livewire.<name>` inside the livewire namespace. */
  name: string;
  /** Whether it's a class, function, type and so on. */
  kind: ApiKind;
  /** False for a base class that is reachable only through a subclass. */
  exported: boolean;
  /** Its declarations as an editor shows them (a class's header, a function's overloads). */
  signature: string[];
  /** Its JSDoc, without comment markers. */
  doc: string;
  /** Where it's declared, relative to the package root. */
  file: string;
  /** The 1-based line of the declaration. */
  line: number;
  /** The entries this class or interface extends. */
  bases?: string[];
  /** The members it declares itself. */
  members?: ApiMember[];
  /** A namespace's exported entries. */
  contents?: string[];
}

/** The whole index. */
export interface ApiIndex {
  /** The package version it was built from. */
  version: string;
  /** The keys of the names the package exports. */
  exports: string[];
  /** Every entry, by key. */
  entries: Record<string, ApiEntry>;
}
