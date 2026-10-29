/**
 * Type declarations for the plain-ESM governance queue mapping module.
 * The implementation stays `.mjs` so `node --test` can import it without a build step.
 */
export declare function queueKind(path: string): 'appeals' | 'groups' | 'reports'
export declare function canDecide(path: string): boolean
export declare function queueEndpoint(path: string): string
export declare function decideEndpoint(path: string, id: string): string
